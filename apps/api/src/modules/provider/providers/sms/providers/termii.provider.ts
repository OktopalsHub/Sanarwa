import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISMSProvider, SMSPayload, SMSResponse, BulkSMSPayload, BulkSMSResponse } from '../sms-provider.interface';

@Injectable()
export class TermiiProvider implements ISMSProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly apiUrl = 'https://v3.api.termii.com/api/sms/send';

  // Termii pricing (focused on African countries, in USD)
  private readonly countryPricing: Record<string, number> = {
    'NG': 0.015, // Nigeria
    'GH': 0.02,  // Ghana
    'KE': 0.025, // Kenya
    'ZA': 0.03,  // South Africa
    'UG': 0.025, // Uganda
    'TZ': 0.025, // Tanzania
    'RW': 0.03,  // Rwanda
    'ET': 0.025, // Ethiopia
    'SN': 0.035, // Senegal
    'CI': 0.035, // Ivory Coast
    'BF': 0.04,  // Burkina Faso
    'ML': 0.04,  // Mali
    'BJ': 0.035, // Benin
    'TG': 0.035, // Togo
    '*': 0.05,   // Default for other countries
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get('TERMII_API_KEY') || '';
    this.senderId = this.configService.get('TERMII_SENDER_ID') || '';
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      // Sender ID priority: payload.from > senderId
      const senderId = payload.from || this.senderId;

      const termiiPayload = {
        to: payload.to,
        from: senderId,
        sms: payload.message,
        type: 'plain',
        channel: 'generic', // SMS only
        api_key: this.apiKey,
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(termiiPayload),
      });

      const result = await response.json() as { code?: string; message?: string; message_id?: string; balance?: number };

      if (!response.ok || result.code !== 'ok') {
        throw new Error(`Termii API error: ${result.message || response.statusText}`);
      }

      this.logger.log(`SMS sent successfully via Termii: ${result.message_id}`);

      return {
        success: true,
        messageId: result.message_id!,
        cost: result.balance || 0,
        provider: 'termii',
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via Termii: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'termii',
      };
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      const senderId = payload.from || this.senderId;
      const results: BulkSMSResponse['results'] = [];
      let totalCost = 0;

      // Termii supports bulk SMS with comma-separated recipients
      const termiiPayload = {
        to: payload.recipients.join(','),
        from: senderId,
        sms: payload.message,
        type: 'plain',
        channel: 'generic',
        api_key: this.apiKey,
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(termiiPayload),
      });

      const result = await response.json() as { code?: string; message?: string; message_id?: string; balance?: number };

      if (!response.ok || result.code !== 'ok') {
        // If bulk fails, mark all as failed
        payload.recipients.forEach(recipient => {
          results.push({
            recipient,
            success: false,
            error: result.message || response.statusText,
          });
        });
      } else {
        // If bulk succeeds, mark all as successful
        payload.recipients.forEach(recipient => {
          results.push({
            recipient,
            messageId: result.message_id,
            success: true,
          });
        });
        totalCost = result.balance || 0;
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via Termii: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: 'termii',
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via Termii: ${error.message}`, error.stack);

      // Mark all as failed
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
        provider: 'termii',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apiKey && this.senderId);
  }

  getProviderName(): string {
    return 'termii';
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing['*'];
  }
}