import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { MessageDeliveryStatus as DeliveryStatus } from '../messaging/message-delivery.entity';
import { MessageChannel as NotificationChannel } from '../messaging/message.entity';
import { WebhookService as DatabaseWebhookService } from '../webhook/webhook.service';
import { WebhookQueueService } from './queue/webhook-queue.service';

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
  // Context information
  tenantId: string;
  projectId: string;
}

export interface DeliveryEventWebhookPayload {
  deliveryId: string;
  notificationId: string;
  eventType: 'opened' | 'clicked' | 'unsubscribed';
  timestamp: Date;
  metadata?: Record<string, any>;
  // Context information
  tenantId: string;
  projectId: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly databaseWebhookService?: DatabaseWebhookService,
    @Optional() @Inject(forwardRef(() => WebhookQueueService)) private readonly webhookQueueService?: WebhookQueueService,
  ) {}

  /**
   * Register webhook configuration for a tenant (legacy method for backward compatibility)
   * @deprecated Use the WebhookModule for webhook management instead
   */
  registerWebhook(tenantId: string, config: WebhookConfig): void {
    this.logger.warn(`registerWebhook is deprecated. Use WebhookModule for webhook management`);
  }

  /**
   * Remove webhook configuration for a tenant (legacy method for backward compatibility)
   * @deprecated Use the WebhookModule for webhook management instead
   */
  removeWebhook(tenantId: string): void {
    this.logger.warn(`removeWebhook is deprecated. Use WebhookModule for webhook management`);
  }

  /**
   * Send delivery status webhook notification
   */
  async sendDeliveryStatusWebhook(
    tenantId: string,
    payload: DeliveryStatusWebhookPayload,
  ): Promise<void> {
    if (!this.databaseWebhookService) {
      this.logger.debug(`Database webhook service not available`);
      return;
    }

    // Find active webhooks for this event
    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(tenantId, 'email.delivered');
    if (webhooks.length === 0) {
      this.logger.debug(`No active webhooks configured for tenant ${tenantId} and event email.delivered`);
      return;
    }

    // Send to all matching webhooks
    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: 'delivery_status_update',
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

  /**
   * Send delivery event webhook notification
   */
  async sendDeliveryEventWebhook(
    tenantId: string,
    payload: DeliveryEventWebhookPayload,
  ): Promise<void> {
    if (!this.databaseWebhookService) {
      this.logger.debug(`Database webhook service not available`);
      return;
    }

    // Find active webhooks for this event
    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(tenantId, `email.${payload.eventType}`);
    if (webhooks.length === 0) {
      this.logger.debug(`No active webhooks configured for tenant ${tenantId} and event email.${payload.eventType}`);
      return;
    }

    // Send to all matching webhooks
    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: 'delivery_event',
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

  /**
   * Send bulk notification webhook
   */
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

    // Find active webhooks for bulk notifications
    const webhooks = await this.databaseWebhookService.findActiveWebhooksForEvent(tenantId, 'notification.bulk_completed');
    if (webhooks.length === 0) {
      this.logger.debug(`No active webhooks configured for tenant ${tenantId} and event notification.bulk_completed`);
      return;
    }

    // Send to all matching webhooks
    for (const webhook of webhooks) {
      const config: WebhookConfig = {
        url: webhook.url,
        secret: webhook.secret,
        retryAttempts: 3,
        timeout: 10000,
      };

      const webhookPayload = {
        type: 'bulk_notification_complete',
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

  /**
   * Test webhook configuration (legacy method)
   * @deprecated Use the WebhookModule for webhook testing instead
   */
  async testWebhook(tenantId: string): Promise<boolean> {
    this.logger.warn(`testWebhook is deprecated. Use WebhookModule for webhook testing`);
    return false;
  }

  /**
   * Get webhook configuration for a tenant (legacy method)
   * @deprecated Use the WebhookModule for webhook management instead
   */
  getWebhookConfig(tenantId: string): WebhookConfig | undefined {
    this.logger.warn(`getWebhookConfig is deprecated. Use WebhookModule for webhook management`);
    return undefined;
  }

  /**
   * Private method to send webhook with retry logic
   */
  private async sendWebhook(
    config: WebhookConfig,
    payload: any,
    idempotencyKey: string,
    tenantId?: string,
  ): Promise<void> {
    const maxRetries = config.retryAttempts || 3;
    const timeout = Math.max(0, config.timeout || 10000);

    try {
      // First attempt - try immediate delivery
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(payload, config.secret),
        'X-Idempotency-Key': idempotencyKey,
        'X-Attempt': '1',
        ...config.headers,
      };

      const response: AxiosResponse = await axios.post(config.url, payload, {
        headers,
        timeout,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      this.logger.log(
        `Webhook sent successfully to ${config.url} (attempt 1): ${response.status}`,
      );
      return;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;

      this.logger.warn(
        `Webhook attempt 1/${maxRetries} failed for ${config.url}: ${statusCode} ${errorMessage}`,
      );

      // Queue for retry if queue service is available
      if (this.webhookQueueService) {
        try {
          await this.webhookQueueService.queueWebhookRetry({
            tenantId: tenantId || 'default',
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
          this.logger.error(
            `Failed to queue webhook retry: ${queueError.message}`,
          );
        }
      }

      // Fallback: retry synchronously if queue is not available
      this.logger.warn(
        `Webhook queue not available, falling back to synchronous retry for ${config.url}`,
      );
      await this.retrySynchronously(config, payload, idempotencyKey, maxRetries);
    }
  }

  /**
   * Synchronous retry fallback (used when queue is not available)
   */
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
          'Content-Type': 'application/json',
          'X-Webhook-Signature': this.generateSignature(payload, config.secret),
          'X-Idempotency-Key': idempotencyKey,
          'X-Attempt': attempt.toString(),
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

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Generate HMAC signature for webhook security
   */
  private generateSignature(payload: any, secret?: string): string {
    if (!secret) {
      return '';
    }

    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Utility method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate webhook URL format
   */
  validateWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Get webhook delivery statistics
   */
  async getWebhookStats(tenantId: string): Promise<{
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
  }> {
    // In a real implementation, you would track webhook delivery statistics
    // This is a placeholder that returns mock data
    return {
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
    };
  }
}
