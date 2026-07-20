import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider } from '../base/base-provider.abstract';
import { IEmailProvider, EmailConfig, EmailPayload } from './email-provider.interface';
import { ProviderResponse } from '../types';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SendGridEmailProvider extends BaseProvider implements IEmailProvider {
  private axiosInstance: AxiosInstance;
  private emailConfig: EmailConfig;

  async initialize(config: any): Promise<void> {
    this._config = config;
    this.emailConfig = config.config as EmailConfig;

    if (!this.emailConfig.apiKey) {
      throw new Error('SendGrid API key is required');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: {
        Authorization: `Bearer ${this.emailConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('SendGrid email provider initialized');
  }

  async send(payload: EmailPayload): Promise<ProviderResponse> {
    try {
      const startTime = Date.now();

      this.logger.log(`Sending email via SendGrid to ${payload.recipient}`);

      const sendGridPayload = {
        personalizations: [
          {
            to: [{ email: payload.recipient }],
            subject: payload.subject,
          },
        ],
        from: {
          email: payload.from || this.emailConfig.fromEmail,
          name: payload.fromName || this.emailConfig.fromName,
        },
        reply_to: payload.replyTo
          ? { email: payload.replyTo }
          : undefined,
        content: [
          {
            type: 'text/plain',
            value: payload.textContent || '',
          },
          {
            type: 'text/html',
            value: payload.htmlContent || '',
          },
        ],
        ...(payload.attachments && {
          attachments: payload.attachments.map(att => ({
            content: att.content,
            filename: att.filename,
            type: att.contentType,
            disposition: 'attachment',
          })),
        }),
        ...(payload.metadata && {
          custom_args: payload.metadata,
        }),
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
          subscription_tracking: { enable: false },
        },
      };

      const response = await this.axiosInstance.post('/mail/send', sendGridPayload);

      const responseTime = Date.now() - startTime;

      this.logger.log(
        `Email sent successfully via SendGrid to ${payload.recipient} (${responseTime}ms)`,
      );

      return {
        messageId: response.headers['x-message-id'] || `sendgrid_${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
        metadata: {
          messageId: response.headers['x-message-id'],
        },
      } as ProviderResponse;
    } catch (error) {
      this.logger.error(
        `Failed to send email via SendGrid to ${payload.recipient}`,
        error.response?.data || error.message,
      );

      return {
        messageId: `sendgrid_error_${Date.now()}`,
        status: 'failed',
        timestamp: new Date(),
        error: error.response?.data?.errors?.[0]?.message || error.message,
      } as ProviderResponse;
    }
  }

  async validateConfig(config: any): Promise<boolean> {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('SendGrid API key is required');
    }

    if (!config.fromEmail) {
      errors.push('From email is required');
    }

    if (config.fromEmail && !this.isValidEmail(config.fromEmail)) {
      errors.push('Invalid from email format');
    }

    return errors.length === 0;
  }

  protected async performHealthCheck(): Promise<import('../types').ProviderHealthStatus> {
    try {
      const startTime = Date.now();
      await this.getHealth();
      return {
        status: 'healthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      } as import('../types').ProviderHealthStatus;
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date(),
        errorRate: 100,
      } as import('../types').ProviderHealthStatus;
    }
  }

  async getHealth(): Promise<{ status: string; message?: string }> {
    try {
      // Test API connection
      await this.axiosInstance.get('/mail/settings');

      return { status: 'healthy' };
    } catch (error) {
      this.logger.error('SendGrid health check failed', error.message);
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }

  async getQuota(): Promise<{ used: number; limit: number; remaining: number }> {
    try {
      // SendGrid doesn't provide quota via API, return default
      return {
        used: 0,
        limit: 100000,
        remaining: 100000,
      };
    } catch (error) {
      this.logger.error('Failed to get SendGrid quota', error.message);
      throw error;
    }
  }

  async handleWebhook(event: any): Promise<void> {
    try {
      const eventType = event.event;

      this.logger.log(`Processing SendGrid webhook event: ${eventType}`);

      // Map SendGrid events to standard events
      const eventMap: Record<string, string> = {
        delivered: 'email.delivered',
        bounce: 'email.bounced',
        dropped: 'email.failed',
        open: 'email.opened',
        click: 'email.clicked',
        unsubscribe: 'email.unsubscribed',
        spamreport: 'email.spam_reported',
      };

      const standardEvent = eventMap[eventType];
      if (standardEvent) {
        // Emit event for processing
        this.logger.log(`Mapped SendGrid event ${eventType} to ${standardEvent}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle SendGrid webhook', error);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getProviderName(): string {
    return 'sendgrid';
  }

  getSupportedCountries(): string[] {
    return ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX'];
  }

  getCostPerMessage(): number {
    // SendGrid pricing varies, average ~$0.0001 per email
    return 0.0001;
  }
}
