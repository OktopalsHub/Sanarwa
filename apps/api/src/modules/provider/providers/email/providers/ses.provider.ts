import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../../../../common/enums/notification-channel.enum';
import { SESClient, SendEmailCommand, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import { BaseEmailProvider, EmailDeliveryResult, EmailMessage, EmailProviderConfig, EmailProviderStats } from '../email-provider.interface';

interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail?: string;
  fromName?: string;
}

@Injectable()
export class SESProvider extends BaseEmailProvider {
  readonly providerId = 'aws_ses';
  readonly name = 'Amazon SES';
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(SESProvider.name);
  private sesClient: SESClient;
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    try {
      const sesConfig = this.config.config as SESConfig;

      this.sesClient = new SESClient({
        region: sesConfig.region || 'us-east-1',
        credentials: {
          accessKeyId: sesConfig.accessKeyId,
          secretAccessKey: sesConfig.secretAccessKey,
        },
      });

      this.isInitialized = true;
      this.logger.log('SES provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SES provider', error);
      throw new Error(`SES initialization failed: ${error.message}`);
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const sesConfig = this.config.config as SESConfig;

    try {
      // Determine the source email address
      let sourceEmail: string;

      if (message.from) {
        // Use the provided from address (should be from verified domain)
        sourceEmail = message.from;
      } else if (message.brandConfig?.defaultFromEmail && message.brandConfig?.defaultFromName) {
        // Use brand-specific from address if available
        sourceEmail = `${message.brandConfig.defaultFromName} <${message.brandConfig.defaultFromEmail}>`;
      } else {
        // Fallback to provider config
        sourceEmail = `${sesConfig.fromName || 'Notification'} <${sesConfig.fromEmail}>`;
      }

      const command = new SendEmailCommand({
        Source: sourceEmail,
        Destination: {
          ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
          CcAddresses: message.cc,
          BccAddresses: message.bcc,
        },
        Message: {
          Subject: {
            Data: message.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: message.html ? {
              Data: message.html,
              Charset: 'UTF-8',
            } : undefined,
            Text: message.text ? {
              Data: message.text,
              Charset: 'UTF-8',
            } : undefined,
          },
        },
        ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
      });

      const result = await this.sesClient.send(command);
      const latency = Date.now() - startTime;

      this.logger.log(`Email sent successfully via SES: ${result.MessageId} from ${sourceEmail}`);

      return {
        messageId: result.MessageId || `ses_${Date.now()}`,
        status: 'sent',
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency,
          region: sesConfig.region,
          sourceEmail,
          branded: !!message.brandConfig
        }
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error(`Failed to send email via SES: ${error.message}`, error.stack);

      return {
        messageId: `ses_failed_${Date.now()}`,
        status: 'failed',
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          latency,
          errorCode: error.name,
          sourceEmail: message.from || `${sesConfig.fromName || 'Notification'} <${sesConfig.fromEmail}>`
        }
      };
    }
  }

  async validateConfig(config: Record<string, any>): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const sesConfig = config as SESConfig;

    if (!sesConfig.accessKeyId) {
      errors.push('AWS Access Key ID is required');
    }

    if (!sesConfig.secretAccessKey) {
      errors.push('AWS Secret Access Key is required');
    }

    if (!sesConfig.region) {
      errors.push('AWS Region is required');
    }

    if (sesConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sesConfig.fromEmail)) {
      errors.push('Invalid from email format');
    }

    // Test credentials if provided
    if (sesConfig.accessKeyId && sesConfig.secretAccessKey && sesConfig.region && errors.length === 0) {
      try {
        const testClient = new SESClient({
          region: sesConfig.region,
          credentials: {
            accessKeyId: sesConfig.accessKeyId,
            secretAccessKey: sesConfig.secretAccessKey,
          },
        });

        // Test by getting sending quota
        await testClient.send(new GetSendQuotaCommand({}));
      } catch (error) {
        if (error.name === 'InvalidClientTokenId') {
          errors.push('Invalid AWS Access Key ID');
        } else if (error.name === 'SignatureDoesNotMatch') {
          errors.push('Invalid AWS Secret Access Key');
        } else if (error.name === 'UnauthorizedOperation') {
          errors.push('AWS credentials do not have SES permissions');
        } else {
          errors.push(`AWS SES configuration test failed: ${error.message}`);
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

      // SES doesn't provide detailed stats via API, return basic info
      return {
        totalSent: 0,
        totalFailed: 0,
        averageLatency: 0,
        deliveryRate: 0,
        lastUsed: new Date(),
        costToDate: 0
      };
    } catch (error) {
      this.logger.error('Failed to fetch SES stats', error);
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

      // Test by getting sending quota
      await this.sesClient.send(new GetSendQuotaCommand({}));

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

  private async calculateCost(messageCount: number): Promise<number> {
    // SES pricing: $0.10 per 1000 emails
    const baseCost = messageCount * 0.0001;

    // Add infrastructure fee (20% markup for AWS services)
    const infrastructureFee = baseCost * 0.2;

    return baseCost + infrastructureFee;
  }
}