import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderWebhookEvent } from "../interfaces/byop.interface";
import { ProviderConfig } from "../provider-config.entity";
import { assertSafeWebhookUrl } from "../../../common/security/utils/safe-url";

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  createdAt: Date;
  lastTriggered?: Date;
}

@Injectable()
export class ProviderWebhookService {
  private readonly logger = new Logger(ProviderWebhookService.name);
  private readonly subscriptions = new Map<string, WebhookSubscription[]>();

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.setupEventListeners();
  }

  /**
   * Subscribe to provider webhook events
   */
  async subscribe(
    tenantId: string,
    subscription: Omit<WebhookSubscription, "id" | "createdAt">,
  ): Promise<WebhookSubscription> {
    await assertSafeWebhookUrl(subscription.url);

    const webhookSubscription: WebhookSubscription = {
      ...subscription,
      id: this.generateId(),
      tenantId,
      createdAt: new Date(),
    };

    if (!this.subscriptions.has(tenantId)) {
      this.subscriptions.set(tenantId, []);
    }

    this.subscriptions.get(tenantId)!.push(webhookSubscription);

    this.logger.log(
      `Created webhook subscription ${webhookSubscription.id} for tenant ${tenantId}`,
    );

    return webhookSubscription;
  }

  /**
   * Unsubscribe from webhook events
   */
  async unsubscribe(tenantId: string, subscriptionId: string): Promise<void> {
    const subscriptions = this.subscriptions.get(tenantId);
    if (!subscriptions) return;

    const index = subscriptions.findIndex((sub) => sub.id === subscriptionId);
    if (index !== -1) {
      subscriptions.splice(index, 1);
      this.logger.log(`Removed webhook subscription ${subscriptionId} for tenant ${tenantId}`);
    }
  }

  /**
   * Get all subscriptions for a tenant
   */
  getSubscriptions(tenantId: string): WebhookSubscription[] {
    return this.subscriptions.get(tenantId) || [];
  }

  /**
   * Trigger webhook event
   */
  async triggerEvent(event: ProviderWebhookEvent): Promise<void> {
    // Find provider config to get tenant ID
    const providerConfig = await this.providerConfigRepository.findOne({
      where: { providerId: event.providerId },
      relations: ["project", "project.tenant"],
    });

    if (!providerConfig) {
      this.logger.warn(`Provider config not found for ${event.providerId}`);
      return;
    }

    const tenantId = providerConfig.project.tenant.id;
    const subscriptions = this.subscriptions.get(tenantId) || [];

    // Filter subscriptions that are interested in this event
    const interestedSubscriptions = subscriptions.filter(
      (sub) => sub.isActive && sub.events.includes(event.type),
    );

    if (interestedSubscriptions.length === 0) {
      this.logger.debug(`No active subscriptions for event ${event.type} in tenant ${tenantId}`);
      return;
    }

    // Send webhooks
    const webhookPromises = interestedSubscriptions.map((subscription) =>
      this.sendWebhook(subscription, event),
    );

    await Promise.allSettled(webhookPromises);

    // Emit internal event for other services
    this.eventEmitter.emit("provider.webhook.triggered", {
      tenantId,
      event,
      subscriptionCount: interestedSubscriptions.length,
    });
  }

  /**
   * Send webhook to a specific subscription
   */
  private async sendWebhook(
    subscription: WebhookSubscription,
    event: ProviderWebhookEvent,
    attempt: number = 1,
  ): Promise<void> {
    try {
      await assertSafeWebhookUrl(subscription.url);

      const payload = {
        id: this.generateId(),
        event: event.type,
        timestamp: event.timestamp.toISOString(),
        data: {
          providerId: event.providerId,
          channel: event.channel,
          severity: event.severity,
          ...event.data,
        },
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "BYOP-Webhook/1.0",
        "X-Webhook-Event": event.type,
        "X-Webhook-Timestamp": event.timestamp.toISOString(),
        "X-Webhook-Attempt": attempt.toString(),
      };

      // Add signature if secret is provided
      if (subscription.secret) {
        const signature = await this.generateSignature(
          JSON.stringify(payload),
          subscription.secret,
        );
        headers["X-Webhook-Signature"] = signature;
      }

      const response = await fetch(subscription.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update last triggered time
      subscription.lastTriggered = new Date();

      this.logger.debug(`Webhook sent successfully to ${subscription.url} for event ${event.type}`);
    } catch (error) {
      this.logger.error(
        `Failed to send webhook to ${subscription.url} (attempt ${attempt}): ${error.message}`,
      );

      // Retry logic
      if (attempt < subscription.retryPolicy.maxRetries) {
        const backoffMs = Math.min(
          subscription.retryPolicy.backoffMultiplier ** (attempt - 1) * 1000,
          subscription.retryPolicy.maxBackoffMs,
        );

        setTimeout(() => {
          this.sendWebhook(subscription, event, attempt + 1);
        }, backoffMs);
      } else {
        this.logger.error(`Max retries exceeded for webhook ${subscription.id}. Giving up.`);

        // Emit failure event
        this.eventEmitter.emit("provider.webhook.failed", {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          event,
          error: error.message,
        });
      }
    }
  }

  /**
   * Set up event listeners for provider events
   */
  private setupEventListeners(): void {
    // Listen for provider status changes
    this.eventEmitter.on(
      "provider.status.changed",
      async (data: {
        providerId: string;
        channel: NotificationChannel;
        oldStatus: string;
        newStatus: string;
        metadata?: Record<string, any>;
      }) => {
        await this.triggerEvent({
          type: "provider.status.changed",
          providerId: data.providerId,
          channel: data.channel.toString(),
          timestamp: new Date(),
          severity: data.newStatus === "unhealthy" ? "critical" : "info",
          data: {
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
            ...data.metadata,
          },
        });
      },
    );

    // Listen for quota exceeded events
    this.eventEmitter.on(
      "provider.quota.exceeded",
      async (data: {
        providerId: string;
        channel: NotificationChannel;
        quotaType: string;
        limit: number;
        current: number;
      }) => {
        await this.triggerEvent({
          type: "provider.quota.exceeded",
          providerId: data.providerId,
          channel: data.channel.toString(),
          timestamp: new Date(),
          severity: "warning",
          data: {
            quotaType: data.quotaType,
            limit: data.limit,
            current: data.current,
            utilizationPercentage: (data.current / data.limit) * 100,
          },
        });
      },
    );

    // Listen for cost threshold events
    this.eventEmitter.on(
      "provider.cost.threshold",
      async (data: {
        providerId: string;
        channel: NotificationChannel;
        threshold: number;
        currentCost: number;
        period: string;
      }) => {
        await this.triggerEvent({
          type: "provider.cost.threshold",
          providerId: data.providerId,
          channel: data.channel.toString(),
          timestamp: new Date(),
          severity: "warning",
          data: {
            threshold: data.threshold,
            currentCost: data.currentCost,
            period: data.period,
            exceedancePercentage: ((data.currentCost - data.threshold) / data.threshold) * 100,
          },
        });
      },
    );

    // Listen for failover events
    this.eventEmitter.on(
      "provider.failover.triggered",
      async (data: {
        fromProviderId: string;
        toProviderId: string;
        channel: NotificationChannel;
        reason: string;
        messageCount: number;
      }) => {
        await this.triggerEvent({
          type: "provider.failover.triggered",
          providerId: data.fromProviderId,
          channel: data.channel.toString(),
          timestamp: new Date(),
          severity: "warning",
          data: {
            fromProvider: data.fromProviderId,
            toProvider: data.toProviderId,
            reason: data.reason,
            affectedMessages: data.messageCount,
          },
        });
      },
    );
  }

  /**
   * Generate webhook signature for security
   */
  private async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return `sha256=${hashHex}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate webhook signature
   */
  async validateSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      const expectedSignature = await this.generateSignature(payload, secret);
      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Failed to validate webhook signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Get webhook delivery statistics
   */
  getDeliveryStats(tenantId: string): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
  } {
    const subscriptions = this.subscriptions.get(tenantId) || [];

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((sub) => sub.isActive).length,
      totalDeliveries: 0, // TODO: Implement delivery tracking
      successfulDeliveries: 0,
      failedDeliveries: 0,
    };
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(subscription: WebhookSubscription): Promise<{
    success: boolean;
    responseTime: number;
    statusCode?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const testEvent: ProviderWebhookEvent = {
        type: "provider.status.changed",
        providerId: "test-provider",
        channel: "email",
        timestamp: new Date(),
        severity: "info",
        data: {
          test: true,
          message: "This is a test webhook",
        },
      };

      await this.sendWebhook(subscription, testEvent);

      return {
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}
