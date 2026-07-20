import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISMSProvider, SMSPayload, SMSResponse, BulkSMSPayload, BulkSMSResponse } from '../sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISMSProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  // Twilio pricing per country (approximate, in USD)
  private readonly countryPricing: Record<string, number> = {
    'US': 0.0075,
    'CA': 0.0075,
    'GB': 0.04,
    'DE': 0.075,
    'FR': 0.075,
    'AU': 0.05,
    'IN': 0.0065,
    'BR': 0.025,
    'MX': 0.025,
    'JP': 0.08,
    'KR': 0.045,
    'CN': 0.05,
    '*': 0.05, // Default for unsupported countries
  };

  constructor(private configService: ConfigService) {
    this.accountSid = this.configService.get('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get('TWILIO_AUTH_TOKEN') || '';
    this.fromNumber = this.configService.get('TWILIO_FROM_NUMBER') || '';
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      const twilioPayload = {
        To: payload.to,
        From: payload.from || this.fromNumber,
        Body: payload.message,
      };

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(twilioPayload).toString(),
        }
      );

      const result = await response.json() as { message?: string; sid?: string; price?: string };

      if (!response.ok) {
        throw new Error(`Twilio API error: ${result.message || response.statusText}`);
      }

      this.logger.log(`SMS sent successfully via Twilio: ${result.sid}`);

      return {
        success: true,
        messageId: result.sid!,
        cost: parseFloat(result.price!) || 0,
        provider: 'twilio',
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via Twilio: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'twilio',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  getProviderName(): string {
    return 'twilio';
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing['*'];
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      const results: BulkSMSResponse['results'] = [];
      let totalCost = 0;

      // Twilio doesn't have native bulk SMS, so we send individual messages
      for (const recipient of payload.recipients) {
        try {
          const smsResult = await this.sendSMS({
            to: recipient,
            message: payload.message,
            from: payload.from,
            metadata: payload.metadata,
          });

          results.push({
            recipient,
            messageId: smsResult.messageId,
            success: smsResult.success,
            error: smsResult.error,
          });

          if (smsResult.success && smsResult.cost) {
            totalCost += smsResult.cost;
          }
        } catch (error) {
          results.push({
            recipient,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via Twilio: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: 'twilio',
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via Twilio: ${error.message}`, error.stack);

      const results = payload.recipients.map(recipient => ({
        recipient,
        success: false,
        error: error.message,
      }));

      return {
        success: false,
        results,
        totalCost: 0,
        successCount: 0,
        failureCount: payload.recipients.length,
        provider: 'twilio',
      };
    }
  }
}