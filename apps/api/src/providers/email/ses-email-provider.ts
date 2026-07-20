import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { BaseProvider } from '../base/base-provider.abstract';
import {
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from '../types';
import {
  EmailConfig,
  EmailPayload,
  IEmailProvider,
} from './email-provider.interface';

@Injectable()
export class SESEmailProvider extends BaseProvider implements IEmailProvider {
  private sesClient: SESClient;
  private emailConfig: EmailConfig;

  constructor() {
    super('ses', 'AWS SES', Channel.EMAIL);
  }

  async send(payload: EmailPayload): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse('Provider not initialized');
    }

    try {
      const params: SendEmailCommandInput = {
        Source: payload.from || this.emailConfig.fromEmail,
        Destination: {
          ToAddresses: [payload.recipient],
        },
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: payload.htmlContent
              ? {
                  Data: payload.htmlContent,
                  Charset: 'UTF-8',
                }
              : undefined,
            Text: payload.textContent
              ? {
                  Data: payload.textContent,
                  Charset: 'UTF-8',
                }
              : undefined,
          },
        },
        ReplyToAddresses: payload.replyTo
          ? [payload.replyTo]
          : this.emailConfig.replyToEmail
            ? [this.emailConfig.replyToEmail]
            : undefined,
      };

      const command = new SendEmailCommand(params);
      const result = await this.sesClient.send(command);

      this.logger.log(`Email sent successfully via SES: ${result.MessageId}`);

      return this.createSuccessResponse(`ses-${Date.now()}`, result.MessageId, {
        recipient: payload.recipient,
        subject: payload.subject,
      });
    } catch (error) {
      this.logger.error(`Failed to send email via SES:`, error);
      return this.createErrorResponse(
        `SES Error: ${error.message}`,
        `ses-error-${Date.now()}`,
      );
    }
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as EmailConfig;

    // Check required fields
    if (!credentials.fromEmail) {
      this.logger.error('SES configuration missing fromEmail');
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.fromEmail)) {
      this.logger.error('SES configuration has invalid fromEmail format');
      return false;
    }

    if (
      credentials.replyToEmail &&
      !emailRegex.test(credentials.replyToEmail)
    ) {
      this.logger.error('SES configuration has invalid replyToEmail format');
      return false;
    }

    return true;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    try {
      // Test SES connectivity by getting send quota
      const { GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendQuotaCommand({});
      await this.sesClient.send(command);

      return {
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
        uptime: 100,
        metadata: {
          service: 'AWS SES',
          region: this.sesClient.config.region,
        },
      };
    } catch (error) {
      throw new Error(`SES health check failed: ${error.message}`);
    }
  }

  protected async onInitialize(): Promise<void> {
    this.emailConfig = this.config.credentials as EmailConfig;

    // Initialize SES client
    this.sesClient = new SESClient({
      region: this.emailConfig.region || 'us-east-1',
      credentials: this.emailConfig.apiKey
        ? {
            accessKeyId: this.emailConfig.apiKey,
            secretAccessKey: this.config.credentials.secretKey || '',
          }
        : undefined, // Use default credential chain if no explicit credentials
    });

    this.logger.log(
      `SES Email Provider initialized for region: ${this.emailConfig.region || 'us-east-1'}`,
    );
  }

  protected async onDestroy(): Promise<void> {
    if (this.sesClient) {
      this.sesClient.destroy();
      this.sesClient = undefined as any;
    }
  }

  /**
   * Get SES sending statistics
   */
  async getSendingStatistics(): Promise<any> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    try {
      const { GetSendStatisticsCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendStatisticsCommand({});
      const result = await this.sesClient.send(command);
      return result.SendDataPoints;
    } catch (error) {
      this.logger.error('Failed to get SES sending statistics:', error);
      throw error;
    }
  }

  /**
   * Get SES send quota
   */
  async getSendQuota(): Promise<any> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    try {
      const { GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendQuotaCommand({});
      const result = await this.sesClient.send(command);
      return {
        max24HourSend: result.Max24HourSend,
        maxSendRate: result.MaxSendRate,
        sentLast24Hours: result.SentLast24Hours,
      };
    } catch (error) {
      this.logger.error('Failed to get SES send quota:', error);
      throw error;
    }
  }
}
