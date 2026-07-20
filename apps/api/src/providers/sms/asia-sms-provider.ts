import { Injectable } from '@nestjs/common';
import { BaseProvider } from '../base/base-provider.abstract';
import {
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from '../types';
import { ISMSProvider, SMSConfig, SMSPayload } from './sms-provider.interface';

interface AsiaSMSRequest {
  to: string;
  from: string;
  body: string;
}

interface AsiaSMSResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

@Injectable()
export class AsiaSMSProvider extends BaseProvider implements ISMSProvider {
  private readonly baseUrl = 'https://api.twilio.com/2010-04-01/Accounts';
  private smsConfig: SMSConfig;
  private readonly supportedCountries: string[] = [
    'CN',
    'JP',
    'KR',
    'IN',
    'ID',
    'TH',
    'VN',
    'PH',
    'MY',
    'SG',
    'BD',
    'PK',
    'LK',
    'MM',
    'KH',
    'LA',
    'BN',
    'MV',
    'NP',
    'BT',
    'MN',
    'KZ',
    'UZ',
    'TM',
    'TJ',
    'KG',
    'AF',
    'IR',
    'IQ',
    'SY',
    'JO',
    'LB',
    'IL',
    'PS',
    'SA',
    'AE',
    'QA',
    'BH',
    'KW',
    'OM',
    'YE',
    'GE',
    'AM',
    'AZ',
    'TR',
    'CY',
  ];

  constructor() {
    super('asia-sms', 'Asia SMS Provider', Channel.SMS);
  }

  async send(payload: SMSPayload): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse('Provider not initialized');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(
        payload.recipient,
        payload.countryCode,
      );

      if (
        !this.isCountrySupported(
          payload.countryCode || this.extractCountryCode(formattedNumber),
        )
      ) {
        return this.createErrorResponse(
          'Country not supported by Asia SMS provider',
        );
      }

      const requestData: AsiaSMSRequest = {
        to: formattedNumber,
        from: payload.from || this.smsConfig.senderId || 'AsiaSMS',
        body: payload.message,
      };

      const response = await this.makeHttpRequest(requestData);

      if (response.sid && response.status !== 'failed') {
        this.logger.log(`SMS sent successfully via Asia SMS: ${response.sid}`);

        return this.createSuccessResponse(
          `asia-sms-${Date.now()}`,
          response.sid,
          {
            recipient: formattedNumber,
            message: payload.message,
            status: response.status,
          },
        );
      } else {
        const error = response.error_message || 'Unknown error';
        this.logger.error(`Asia SMS failed: ${error}`);
        return this.createErrorResponse(`Asia SMS Error: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS via Asia SMS:`, error);
      return this.createErrorResponse(
        `Asia SMS Error: ${error.message}`,
        `asia-sms-error-${Date.now()}`,
      );
    }
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as SMSConfig;

    if (!credentials.apiKey) {
      this.logger.error('Asia SMS configuration missing apiKey (Account SID)');
      return false;
    }

    if (!credentials.apiSecret) {
      this.logger.error(
        'Asia SMS configuration missing apiSecret (Auth Token)',
      );
      return false;
    }

    return true;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    try {
      // Test connectivity by fetching account info
      const accountUrl = `${this.baseUrl}/${this.smsConfig.apiKey}.json`;
      const auth = Buffer.from(
        `${this.smsConfig.apiKey}:${this.smsConfig.apiSecret}`,
      ).toString('base64');

      const response = await fetch(accountUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { status: string };

      return {
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
        uptime: 100,
        metadata: {
          service: 'Asia SMS Provider',
          accountStatus: data.status,
          supportedCountries: this.supportedCountries.length,
        },
      };
    } catch (error) {
      throw new Error(`Asia SMS health check failed: ${error.message}`);
    }
  }

  protected async onInitialize(): Promise<void> {
    this.smsConfig = this.config.credentials as SMSConfig;
    this.logger.log(
      `Asia SMS Provider initialized for ${this.supportedCountries.length} Asian countries`,
    );
  }

  getSupportedCountries(): string[] {
    return [...this.supportedCountries];
  }

  isCountrySupported(countryCode: string): boolean {
    if (!countryCode) return false;
    return this.supportedCountries.includes(countryCode.toUpperCase());
  }

  formatPhoneNumber(phoneNumber: string, countryCode?: string): string {
    // If number already starts with +, return as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Country code mapping for Asian countries
    const countryCodeMap: Record<string, string> = {
      CN: '86',
      JP: '81',
      KR: '82',
      IN: '91',
      ID: '62',
      TH: '66',
      VN: '84',
      PH: '63',
      MY: '60',
      SG: '65',
      BD: '880',
      PK: '92',
      LK: '94',
      MM: '95',
      KH: '855',
      LA: '856',
      BN: '673',
      MV: '960',
      NP: '977',
      BT: '975',
      MN: '976',
      KZ: '7',
      UZ: '998',
      TM: '993',
      TJ: '992',
      KG: '996',
      AF: '93',
      IR: '98',
      IQ: '964',
      SY: '963',
      JO: '962',
      LB: '961',
      IL: '972',
      PS: '970',
      SA: '966',
      AE: '971',
      QA: '974',
      BH: '973',
      KW: '965',
      OM: '968',
      YE: '967',
      GE: '995',
      AM: '374',
      AZ: '994',
      TR: '90',
      CY: '357',
    };

    // If country code is provided and supported
    if (countryCode && countryCodeMap[countryCode.toUpperCase()]) {
      const code = countryCodeMap[countryCode.toUpperCase()];

      // Remove leading zeros
      cleaned = cleaned.replace(/^0+/, '');

      // If number doesn't start with country code, add it
      if (!cleaned.startsWith(code)) {
        return `+${code}${cleaned}`;
      }
    }

    // Default to India if no country code provided and looks like local number
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = cleaned.replace(/^0+/, '');
      return `+91${cleaned}`;
    }

    // If number already has country code (length > 11), add +
    if (cleaned.length > 11) {
      return `+${cleaned}`;
    }

    // Fallback: add + to whatever we have
    return `+${cleaned}`;
  }

  private async makeHttpRequest(
    data: AsiaSMSRequest,
  ): Promise<AsiaSMSResponse> {
    const url = `${this.baseUrl}/${this.smsConfig.apiKey}/Messages.json`;
    const auth = Buffer.from(
      `${this.smsConfig.apiKey}:${this.smsConfig.apiSecret}`,
    ).toString('base64');

    const formData = new URLSearchParams();
    formData.append('To', data.to);
    formData.append('From', data.from);
    formData.append('Body', data.body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json() as Promise<AsiaSMSResponse>;
  }

  private extractCountryCode(phoneNumber: string): string {
    // Extract country code from formatted phone number
    if (!phoneNumber.startsWith('+')) {
      return '';
    }

    const countryCodeMap: Record<string, string> = {
      '86': 'CN',
      '81': 'JP',
      '82': 'KR',
      '91': 'IN',
      '62': 'ID',
      '66': 'TH',
      '84': 'VN',
      '63': 'PH',
      '60': 'MY',
      '65': 'SG',
      '880': 'BD',
      '92': 'PK',
      '94': 'LK',
      '95': 'MM',
      '855': 'KH',
      '856': 'LA',
      '673': 'BN',
      '960': 'MV',
      '977': 'NP',
      '975': 'BT',
      '976': 'MN',
      '7': 'KZ',
      '998': 'UZ',
      '993': 'TM',
      '992': 'TJ',
      '996': 'KG',
      '93': 'AF',
      '98': 'IR',
      '964': 'IQ',
      '963': 'SY',
      '962': 'JO',
      '961': 'LB',
      '972': 'IL',
      '970': 'PS',
      '966': 'SA',
      '971': 'AE',
      '974': 'QA',
      '973': 'BH',
      '965': 'KW',
      '968': 'OM',
      '967': 'YE',
      '995': 'GE',
      '374': 'AM',
      '994': 'AZ',
      '90': 'TR',
      '357': 'CY',
    };

    // Try different lengths of country codes (1-3 digits)
    for (let i = 1; i <= 3; i++) {
      const code = phoneNumber.substring(1, 1 + i);
      if (countryCodeMap[code]) {
        return countryCodeMap[code];
      }
    }

    return '';
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const accountUrl = `${this.baseUrl}/${this.smsConfig.apiKey}.json`;
      const auth = Buffer.from(
        `${this.smsConfig.apiKey}:${this.smsConfig.apiSecret}`,
      ).toString('base64');

      const response = await fetch(accountUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Failed to get Asia SMS account info:', error);
      throw error;
    }
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageSid: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const messageUrl = `${this.baseUrl}/${this.smsConfig.apiKey}/Messages/${messageSid}.json`;
      const auth = Buffer.from(
        `${this.smsConfig.apiKey}:${this.smsConfig.apiSecret}`,
      ).toString('base64');

      const response = await fetch(messageUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Failed to get message status:', error);
      throw error;
    }
  }
}
