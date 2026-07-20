import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../../../../common/enums/notification-channel.enum';
import { BaseEmailProvider, EmailDeliveryResult, EmailMessage, EmailProviderConfig, EmailProviderStats } from '../email-provider.interface';

interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: 'us' | 'eu'; // US or EU region
  fromEmail?: string;
  fromName?: string;
  testMode?: boolean;
}

@Injectable()
export class MailgunProvider extends BaseEmailProvider {
  readonly providerId = 'mailgun';
  readonly name = 'Mailgun';
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(MailgunProvider.name);
  private mailgun: any;
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    try {
      const Mailgun = await import('mailgun.js');
      const formData = await import('form-data');

      const mailgun = new Mailgun.default(formData.default);
      const mailgunConfig = this.config.config as MailgunConfig;

      const baseUrl = mailgunConfig.region === 'eu'
        ? 'https://api.eu.mailgun.net'
        : 'https://api.mailgun.net';

      this.mailgun = mailgun.client({
        username: 'api',
        key: mailgunConfig.apiKey,
        url: baseUrl
      });

      this.isInitialized = true;
      this.logger.log('Mailgun provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Mailgun provider', error);
      throw new Error(`Mailgun initialization failed: ${error.message}`);
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const mailgunConfig = this.config.config as MailgunConfig;

    try {
      const messageData: any = {
        from: message.from || `${mailgunConfig.fromName || 'Notification'} <${mailgunConfig.fromEmail}>`,
        to: Array.isArray(message.to) ? message.to.join(',') : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text
      };

      if (message.cc && message.cc.length > 0) {
        messageData.cc = message.cc.join(',');
      }

      if (message.bcc && message.bcc.length > 0) {
        messageData.bcc = message.bcc.join(',');
      }

      if (message.replyTo) {
        messageData['h:Reply-To'] = message.replyTo;
      }

      // Add custom headers
      if (message.headers) {
        Object.entries(message.headers).forEach(([key, value]) => {
          messageData[`h:${key}`] = value;
        });
      }

      // Handle attachments
      if (message.attachments && message.attachments.length > 0) {
        messageData.attachment = message.attachments.map(att => ({
          filename: att.filename,
          data: att.content
        }));
      }

      // Test mode
      if (mailgunConfig.testMode) {
        messageData['o:testmode'] = 'yes';
      }

      // Template support
      if (message.templateId) {
        messageData.template = message.templateId;
        if (message.templateData) {
          Object.entries(message.templateData).forEach(([key, value]) => {
            messageData[`v:${key}`] = value;
          });
        }
      }

      const response = await this.mailgun.messages.create(mailgunConfig.domain, messageData);
      const latency = Date.now() - startTime;

      return {
        messageId: response.id || `mg_${Date.now()}`,
        status: 'queued', // Mailgun queues messages
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency,
          message: response.message,
          domain: mailgunConfig.domain
        }
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error('Mailgun email send failed', {
        error: error.message,
        to: message.to,
        subject: message.subject
      });

      return {
        messageId: `mg_failed_${Date.now()}`,
        status: 'failed',
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          latency,
          statusCode: error.status,
          errorType: error.type || 'unknown'
        }
      };
    }
  }

  async validateConfig(config: Record<string, any>): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const mailgunConfig = config as MailgunConfig;

    if (!mailgunConfig.apiKey) {
      errors.push('API key is required');
    } else if (!mailgunConfig.apiKey.startsWith('key-')) {
      errors.push('Invalid Mailgun API key format (should start with "key-")');
    }

    if (!mailgunConfig.domain) {
      errors.push('Domain is required');
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(mailgunConfig.domain)) {
      errors.push('Invalid domain format');
    }

    if (mailgunConfig.region && !['us', 'eu'].includes(mailgunConfig.region)) {
      errors.push('Region must be either "us" or "eu"');
    }

    if (mailgunConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailgunConfig.fromEmail)) {
      errors.push('Invalid from email format');
    }

    // Test API key and domain if provided
    if (mailgunConfig.apiKey && mailgunConfig.domain && errors.length === 0) {
      try {
        const Mailgun = await import('mailgun.js');
        const formData = await import('form-data');

        const mailgun = new Mailgun.default(formData.default);
        const baseUrl = mailgunConfig.region === 'eu'
          ? 'https://api.eu.mailgun.net'
          : 'https://api.mailgun.net';

        const mg = mailgun.client({
          username: 'api',
          key: mailgunConfig.apiKey,
          url: baseUrl
        });

        // Test by getting domain info
        await mg.domains.get(mailgunConfig.domain);
      } catch (error) {
        if (error.status === 401) {
          errors.push('Invalid API key');
        } else if (error.status === 404) {
          errors.push('Domain not found or not accessible with this API key');
        } else {
          errors.push(`Configuration test failed: ${error.message}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async getStats(): Promise<EmailProviderStats> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const mailgunConfig = this.config.config as MailgunConfig;
      const stats = await this.mailgun.stats.getDomain(mailgunConfig.domain, {
        event: ['accepted', 'delivered', 'failed'],
        duration: '1d'
      });

      const totalSent = stats.items?.reduce((sum: number, item: any) =>
        sum + (item.accepted || 0) + (item.delivered || 0), 0) || 0;

      const totalFailed = stats.items?.reduce((sum: number, item: any) =>
        sum + (item.failed || 0), 0) || 0;

      return {
        totalSent,
        totalFailed,
        averageLatency: 0, // Mailgun doesn't provide latency stats
        deliveryRate: totalSent > 0 ? ((totalSent - totalFailed) / totalSent) * 100 : 0,
        lastUsed: new Date(),
        costToDate: 0 // Would need to calculate based on usage
      };
    } catch (error) {
      this.logger.error('Failed to fetch Mailgun stats', error);
      return {
        totalSent: 0,
        totalFailed: 0,
        averageLatency: 0,
        deliveryRate: 0,
        lastUsed: new Date(),
        costToDate: 0
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const mailgunConfig = this.config.config as MailgunConfig;

      // Test by getting domain info
      await this.mailgun.domains.get(mailgunConfig.domain);

      return {
        healthy: true,
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async getCost(messageCount: number): Promise<number> {
    return this.calculateCost(messageCount);
  }

  async getTemplates(): Promise<Array<{ id: string; name: string; subject: string }>> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const mailgunConfig = this.config.config as MailgunConfig;
      const templates = await this.mailgun.domains.domainTemplates.list(mailgunConfig.domain);

      return templates.items?.map((template: any) => ({
        id: template.name,
        name: template.name,
        subject: template.description || template.name
      })) || [];
    } catch (error) {
      this.logger.error('Failed to fetch Mailgun templates', error);
      return [];
    }
  }

  async createTemplate(template: { name: string; subject: string; html: string; text?: string }): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const mailgunConfig = this.config.config as MailgunConfig;

      const templateData = {
        name: template.name,
        description: template.subject,
        template: template.html,
        tag: 'created-via-api'
      };

      const response = await this.mailgun.domains.domainTemplates.create(mailgunConfig.domain, templateData);

      return response.template.name;
    } catch (error) {
      this.logger.error('Failed to create Mailgun template', error);
      throw new Error(`Template creation failed: ${error.message}`);
    }
  }

  private async calculateCost(messageCount: number): Promise<number> {
    // Mailgun pricing: $0.80 per 1000 emails for first 5k, then tiered pricing
    let cost = 0;

    if (messageCount <= 5000) {
      cost = messageCount * 0.0008; // $0.80 per 1000
    } else if (messageCount <= 10000) {
      cost = 5000 * 0.0008;
      cost += (messageCount - 5000) * 0.0007; // $0.70 per 1000
    } else {
      cost = 5000 * 0.0008;
      cost += 5000 * 0.0007;
      cost += (messageCount - 10000) * 0.0006; // $0.60 per 1000
    }

    // Add infrastructure fee (30% markup)
    const infrastructureFee = cost * 0.3;

    return cost + infrastructureFee;
  }
}