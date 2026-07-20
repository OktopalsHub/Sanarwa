import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider } from '../base/base-provider.abstract';
import { ISMSProvider } from './sms-provider.interface';
import { ProviderResponse } from '../types';
import axios, { AxiosInstance } from 'axios';

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}



@Injectable()
export class TwilioSMSProvider extends BaseProvider implements ISMSProvider {
  private axiosInstance: AxiosInstance;
  private smsConfig: SMSConfig;
  private readonly baseUrl = 'https://api.twilio.com/2010-04-01/Accounts';

  async initialize(config: any): Promise<void> {
    this._config = config;
    this.smsConfig = config.config as SMSConfig;

    if (!this.smsConfig.accountSid || !this.smsConfig.authToken) {
      throw new Error('Twilio Account SID and Auth Token are required');
    }

    const auth = Buffer.from(
      `${this.smsConfig.accountSid}:${this.smsConfig.authToken}`,
    ).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: `${this.baseUrl}/${this.smsConfig.accountSid}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    this.logger.log('Twilio SMS provider initialized');
  }

  async send(payload: import('./sms-provider.interface').SMSPayload): Promise<ProviderResponse> {
    try {
      const startTime = Date.now();

      this.logger.log(`Sending SMS via Twilio to ${payload.recipient}`);

      const data = new URLSearchParams({
        From: payload.from || this.smsConfig.fromNumber,
        To: payload.recipient,
        Body: payload.message,
        ...(payload.metadata?.statusCallback && {
          StatusCallback: payload.metadata.statusCallback,
        }),
      });

      const response = await this.axiosInstance.post('/Messages.json', data);

      const responseTime = Date.now() - startTime;

      this.logger.log(
        `SMS sent successfully via Twilio to ${payload.recipient} (${responseTime}ms)`,
      );

      const status = response.data.status === 'queued' ? 'pending' : response.data.status;

      return {
        messageId: response.data.sid,
        status: status as any,
        timestamp: new Date(),
        metadata: {
          messageSid: response.data.sid,
          status: response.data.status,
          dateCreated: response.data.date_created,
        },
      } as ProviderResponse;
    } catch (error) {
      this.logger.error(
        `Failed to send SMS via Twilio to ${payload.recipient}`,
        error.response?.data || error.message,
      );

      return {
        messageId: `twilio_error_${Date.now()}`,
        status: 'failed',
        timestamp: new Date(),
        error: error.response?.data?.message || error.message,
      } as ProviderResponse;
    }
  }

  async validateConfig(config: any): Promise<boolean> {
    const errors: string[] = [];

    if (!config.accountSid) {
      errors.push('Twilio Account SID is required');
    }

    if (!config.authToken) {
      errors.push('Twilio Auth Token is required');
    }

    if (!config.fromNumber) {
      errors.push('From number is required');
    }

    if (config.fromNumber && !this.isValidPhoneNumber(config.fromNumber)) {
      errors.push('Invalid from number format');
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
      await this.axiosInstance.get('.json');

      return { status: 'healthy' };
    } catch (error) {
      this.logger.error('Twilio health check failed', error.message);
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }

  async getQuota(): Promise<{ used: number; limit: number; remaining: number }> {
    try {
      // Twilio doesn't provide quota via API, return default
      return {
        used: 0,
        limit: 1000000,
        remaining: 1000000,
      };
    } catch (error) {
      this.logger.error('Failed to get Twilio quota', error.message);
      throw error;
    }
  }

  async handleWebhook(event: any): Promise<void> {
    try {
      const messageStatus = event.MessageStatus;

      this.logger.log(`Processing Twilio webhook event: ${messageStatus}`);

      // Map Twilio statuses to standard events
      const statusMap: Record<string, string> = {
        queued: 'sms.queued',
        sending: 'sms.sending',
        sent: 'sms.sent',
        failed: 'sms.failed',
        delivered: 'sms.delivered',
        undelivered: 'sms.failed',
        received: 'sms.received',
      };

      const standardEvent = statusMap[messageStatus];
      if (standardEvent) {
        this.logger.log(`Mapped Twilio status ${messageStatus} to ${standardEvent}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle Twilio webhook', error);
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic validation: should start with + and have 10-15 digits
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  getProviderName(): string {
    return 'twilio';
  }

  getSupportedCountries(): string[] {
    return [
      'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX',
      'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'RU',
    ];
  }

  isCountrySupported(countryCode: string): boolean {
    return this.getSupportedCountries().includes(countryCode.toUpperCase());
  }

  formatPhoneNumber(phoneNumber: string, countryCode?: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If country code provided, prepend it
    if (countryCode) {
      const countryDialCode = this.getCountryDialCode(countryCode);
      if (countryDialCode) {
        return `+${countryDialCode}${cleaned}`;
      }
    }
    
    // Default to +1 if no country code
    return `+1${cleaned}`;
  }

  private getCountryDialCode(countryCode: string): string {
    const dialCodes: Record<string, string> = {
      'US': '1', 'CA': '1', 'GB': '44', 'AU': '61', 'DE': '49', 'FR': '33',
      'JP': '81', 'IN': '91', 'BR': '55', 'MX': '52', 'ES': '34', 'IT': '39',
      'NL': '31', 'SE': '46', 'NO': '47', 'DK': '45', 'FI': '358', 'PL': '48',
      'CZ': '420', 'RU': '7',
    };
    return dialCodes[countryCode.toUpperCase()] || '';
  }

  getCostPerMessage(): number {
    // Twilio pricing varies by country, average ~$0.0075 per SMS
    return 0.0075;
  }
}
