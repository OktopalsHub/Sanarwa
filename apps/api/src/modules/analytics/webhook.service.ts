import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosResponse } from "axios";
import { assertSafeWebhookUrl } from "../../common/security/utils/safe-url";
import { MessageDeliveryStatus as DeliveryStatus } from "../messaging/message-delivery.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { WebhookService as DatabaseWebhookService } from "../webhook/webhook.service";
import { WebhookQueueService } from "./queue/webhook-queue.service";

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retryAttempts?: number;
  timeout?: number;
}

export interface DeliveryStatusWebhookPayload {
  deliveryId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  oldStatus: DeliveryStatus;
  newStatus: DeliveryStatus;
  timestamp: Date;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  tenantId: string;
  projectId: string;
}

export interface DeliveryEventWebhookPayload {
  deliveryId: string;
  notificationId: string;
  eventType: "opened" | "clicked" | "unsubscribed";
  timestamp: Date;
  metadata?: Record<string, any>;
  tenantId: string;
  projectId: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly databaseWebhookService?: DatabaseWebhookService,
    @Optional() private readonly webhookQueueService?: WebhookQueueService,
  ) {}

  async sendDeliveryStatusWebhook(
    tenantId: string,
    payload: DeliveryStatusWebhookPayload,
  ): Promise<void> {
    if (!this.databaseWebhookService) {
      this.logger.debug(`Database webhook service not available`);
      return;
    }

    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(
      tenantId,
      "email.delivered",
    );
    if (webhooks.length === 0) {
      this.logger.debug(
        `No active webhooks configured for tenant ${tenantId} and event email.delivered`,
      );
      return;
    }

    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: "delivery_status_update",
        timestamp: new Date().toISOString(),
        data: {
          ...payload,
          timestamp: payload.timestamp.toISOString(),
        },
      };

      await this.sendWebhook(
        config,
        webhookPayload,
        `delivery-status-${payload.deliveryId}`,
        tenantId,
      );
    }
  }

  async sendDeliveryEventWebhook(
    tenantId: string,
    payload: DeliveryEventWebhookPayload,
  ): Promise<void> {
    if (!this.databaseWebhookService) {
      this.logger.debug(`Database webhook service not available`);
      return;
    }

    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(
      tenantId,
      `email.${payload.eventType}`,
    );
    if (webhooks.length === 0) {
      this.logger.debug(
        `No active webhooks configured for tenant ${tenantId} and event email.${payload.eventType}`,
      );
      return;
    }

    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: "delivery_event",
        timestamp: new Date().toISOString(),
        data: {
          ...payload,
          timestamp: payload.timestamp.toISOString(),
        },
      };

      await this.sendWebhook(
        config,
        webhookPayload,
        `delivery-event-${payload.deliveryId}-${payload.eventType}`,
        tenantId,
      );
    }
  }

  async sendBulkNotificationWebhook(
    tenantId: string,
    payload: {
      batchId: string;
      totalNotifications: number;
      successCount: number;
      failureCount: number;
      timestamp: Date;
    },
  ): Promise<void> {
    if (!this.databaseWebhookService) {
      this.logger.debug(`Database webhook service not available`);
      return;
    }

    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(
      tenantId,
      "notification.bulk_completed",
    );
    if (webhooks.length === 0) {
      this.logger.debug(
        `No active webhooks configured for tenant ${tenantId} and event notification.bulk_completed`,
      );
      return;
    }

    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: "bulk_notification_complete",
        timestamp: new Date().toISOString(),
        data: {
          ...payload,
          timestamp: payload.timestamp.toISOString(),
        },
      };

      await this.sendWebhook(
        config,
        webhookPayload,
        `bulk-notification-${payload.batchId}`,
        tenantId,
      );
    }
  }

  private async sendWebhook(
    config: WebhookConfig,
    payload: any,
    idempotencyKey: string,
    tenantId: string,
  ): Promise<void> {
    assertSafeWebhookUrl(config.url);

    const maxRetries = config.retryAttempts || 3;
    const timeout = Math.max(0, config.timeout || 10000);

    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": this.generateSignature(payload, config.secret),
        "X-Idempotency-Key": idempotencyKey,
        "X-Attempt": "1",
        ...config.headers,
      };

      const response: AxiosResponse = await axios.post(config.url, payload, {
        headers,
        timeout,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      this.logger.log(`Webhook sent successfully to ${config.url} (attempt 1): ${response.status}`);
      return;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;

      this.logger.warn(
        `Webhook attempt 1/${maxRetries} failed for ${config.url}: ${statusCode} ${errorMessage}`,
      );

      if (this.webhookQueueService) {
        try {
          await this.webhookQueueService.queueWebhookRetry({
            tenantId,
            webhookUrl: config.url,
            payload,
            secret: config.secret,
            headers: config.headers,
            timeout,
            idempotencyKey,
            attempt: 2,
            maxRetries,
          });

          this.logger.log(
            `Webhook queued for retry: ${config.url} (will retry up to ${maxRetries} times)`,
          );
          return;
        } catch (queueError) {
          this.logger.error(`Failed to queue webhook retry: ${queueError.message}`);
        }
      }

      this.logger.warn(
        `Webhook queue not available, falling back to synchronous retry for ${config.url}`,
      );
      await this.retrySynchronously(config, payload, idempotencyKey, maxRetries);
    }
  }

  private async retrySynchronously(
    config: WebhookConfig,
    payload: any,
    idempotencyKey: string,
    maxRetries: number,
  ): Promise<void> {
    const timeout = Math.max(0, config.timeout || 10000);
    for (let attempt = 2; attempt <= maxRetries; attempt++) {
      try {
        const headers = {
          "Content-Type": "application/json",
          "X-Webhook-Signature": this.generateSignature(payload, config.secret),
          "X-Idempotency-Key": idempotencyKey,
          "X-Attempt": attempt.toString(),
          ...config.headers,
        };

        const response: AxiosResponse = await axios.post(config.url, payload, {
          headers,
          timeout,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        this.logger.log(
          `Webhook sent successfully to ${config.url} (attempt ${attempt}): ${response.status}`,
        );
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errorMessage = error.response?.data?.message || error.message;
        const statusCode = error.response?.status;

        this.logger.warn(
          `Webhook attempt ${attempt}/${maxRetries} failed for ${config.url}: ${statusCode} ${errorMessage}`,
        );

        if (isLastAttempt) {
          this.logger.error(
            `Webhook failed after ${maxRetries} attempts for ${config.url}: ${errorMessage}`,
          );
          throw new Error(`Webhook delivery failed: ${errorMessage}`, { cause: error });
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.sleep(delay);
      }
    }
  }

  private generateSignature(payload: any, secret?: string): string {
    if (!secret) {
      return "";
    }

    const crypto = require("crypto");
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  validateWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
    } catch {
      return false;
    }
  }

  async getWebhookStats(tenantId: string): Promise<{
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
  }> {
    return {
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
    };
  }
}
