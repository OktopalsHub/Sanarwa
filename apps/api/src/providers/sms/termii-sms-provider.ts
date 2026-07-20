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

interface TermiiSMSRequest {
  to: string;
  from: string;
  sms: string;
  type: string;
  channel: string;
  api_key: string;
}

interface TermiiSMSResponse {
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

@Injectable()
export class TermiiSMSProvider extends BaseProvider implements ISMSProvider {
  private readonly baseUrl = 'https://api.ng.termii.com/api/sms/send';
  private smsConfig: SMSConfig;
  private readonly supportedCountries: string[] = [
    'NG',
    'GH',
    'KE',
    'UG',
    'TZ',
    'ZA',
    'EG',
    'MA',
    'DZ',
    'TN',
    'LY',
    'SD',
    'ET',
    'ZW',
    'ZM',
    'MW',
    'MZ',
    'BW',
    'NA',
    'SZ',
    'LS',
    'MG',
    'MU',
    'SC',
    'CM',
    'CF',
    'TD',
    'CG',
    'CD',
    'GA',
    'GQ',
    'ST',
    'AO',
    'CV',
    'GW',
    'GN',
    'SL',
    'LR',
    'CI',
    'BF',
    'ML',
    'NE',
    'SN',
    'GM',
    'MR',
    'DJ',
    'SO',
    'ER',
    'RW',
    'BI',
  ];

  constructor() {
    super('termii', 'Termii SMS', Channel.SMS);
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
          'Country not supported by Termii provider',
        );
      }

      const requestData: TermiiSMSRequest = {
        to: formattedNumber,
        from: payload.from || this.smsConfig.senderId || 'Termii',
        sms: payload.message,
        type: 'plain',
        channel: 'generic',
        api_key: this.smsConfig.apiKey!,
      };

      const response = await this.makeHttpRequest(requestData);

      if (response.message_id) {
        this.logger.log(
          `SMS sent successfully via Termii: ${response.message_id}`,
        );

        return this.createSuccessResponse(
          `termii-${Date.now()}`,
          response.message_id,
          {
            recipient: formattedNumber,
            message: payload.message,
            balance: response.balance,
          },
        );
      } else {
        this.logger.error(`Termii SMS failed: ${response.message}`);
        return this.createErrorResponse(`Termii Error: ${response.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS via Termii:`, error);
      return this.createErrorResponse(
        `Termii Error: ${error.message}`,
        `termii-error-${Date.now()}`,
      );
    }
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as SMSConfig;

    if (!credentials.apiKey) {
      this.logger.error('Termii configuration missing apiKey');
      return false;
    }

    if (credentials.senderId && credentials.senderId.length > 11) {
      this.logger.error('Termii senderId must be 11 characters or less');
      return false;
    }

    return true;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    try {
      // Test Termii connectivity by checking balance
      const balanceUrl = 'https://api.ng.termii.com/api/get-balance';
      const response = await fetch(
        `${balanceUrl}?api_key=${this.smsConfig.apiKey}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { balance: number; currency: string };

      return {
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
        uptime: 100,
        metadata: {
          service: 'Termii SMS',
          balance: data.balance,
          currency: data.currency,
          supportedCountries: this.supportedCountries.length,
        },
      };
    } catch (error) {
      throw new Error(`Termii health check failed: ${error.message}`);
    }
  }

  protected async onInitialize(): Promise<void> {
    this.smsConfig = this.config.credentials as SMSConfig;
    this.logger.log(
      `Termii SMS Provider initialized for ${this.supportedCountries.length} African countries`,
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

    // Country code mapping for African countries
    const countryCodeMap: Record<string, string> = {
      NG: '234',
      GH: '233',
      KE: '254',
      UG: '256',
      TZ: '255',
      ZA: '27',
      EG: '20',
      MA: '212',
      DZ: '213',
      TN: '216',
      LY: '218',
      SD: '249',
      ET: '251',
      ZW: '263',
      ZM: '260',
      MW: '265',
      MZ: '258',
      BW: '267',
      NA: '264',
      SZ: '268',
      LS: '266',
      MG: '261',
      MU: '230',
      SC: '248',
      CM: '237',
      CF: '236',
      TD: '235',
      CG: '242',
      CD: '243',
      GA: '241',
      GQ: '240',
      ST: '239',
      AO: '244',
      CV: '238',
      GW: '245',
      GN: '224',
      SL: '232',
      LR: '231',
      CI: '225',
      BF: '226',
      ML: '223',
      NE: '227',
      SN: '221',
      GM: '220',
      MR: '222',
      DJ: '253',
      SO: '252',
      ER: '291',
      RW: '250',
      BI: '257',
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

    // Default to Nigeria if no country code provided and looks like local number
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = cleaned.replace(/^0+/, '');
      return `+234${cleaned}`;
    }

    // If number already has country code (length > 11), add +
    if (cleaned.length > 11) {
      return `+${cleaned}`;
    }

    // Fallback: add + to whatever we have
    return `+${cleaned}`;
  }

  private async makeHttpRequest(
    data: TermiiSMSRequest,
  ): Promise<TermiiSMSResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<TermiiSMSResponse>;
  }

  private extractCountryCode(phoneNumber: string): string {
    // Extract country code from formatted phone number
    if (!phoneNumber.startsWith('+')) {
      return '';
    }

    const countryCodeMap: Record<string, string> = {
      '234': 'NG',
      '233': 'GH',
      '254': 'KE',
      '256': 'UG',
      '255': 'TZ',
      '27': 'ZA',
      '20': 'EG',
      '212': 'MA',
      '213': 'DZ',
      '216': 'TN',
      '218': 'LY',
      '249': 'SD',
      '251': 'ET',
      '263': 'ZW',
      '260': 'ZM',
      '265': 'MW',
      '258': 'MZ',
      '267': 'BW',
      '264': 'NA',
      '268': 'SZ',
      '266': 'LS',
      '261': 'MG',
      '230': 'MU',
      '248': 'SC',
      '237': 'CM',
      '236': 'CF',
      '235': 'TD',
      '242': 'CG',
      '243': 'CD',
      '241': 'GA',
      '240': 'GQ',
      '239': 'ST',
      '244': 'AO',
      '238': 'CV',
      '245': 'GW',
      '224': 'GN',
      '232': 'SL',
      '231': 'LR',
      '225': 'CI',
      '226': 'BF',
      '223': 'ML',
      '227': 'NE',
      '221': 'SN',
      '220': 'GM',
      '222': 'MR',
      '253': 'DJ',
      '252': 'SO',
      '291': 'ER',
      '250': 'RW',
      '257': 'BI',
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
   * Get account balance
   */
  async getBalance(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const balanceUrl = 'https://api.ng.termii.com/api/get-balance';
      const response = await fetch(
        `${balanceUrl}?api_key=${this.smsConfig.apiKey}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Failed to get Termii balance:', error);
      throw error;
    }
  }
}
