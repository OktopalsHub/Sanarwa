import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '../../providers/types';
import { ProviderConfig } from './provider-config.entity';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProviderConfigSchema {
  required: string[];
  optional: string[];
  validation: Record<string, (value: any) => boolean>;
  description: Record<string, string>;
}

@Injectable()
export class ProviderConfigValidator {
  private readonly logger = new Logger(ProviderConfigValidator.name);
  private readonly schemas = new Map<string, ProviderConfigSchema>();

  constructor() {
    this.initializeSchemas();
  }

  /**
   * Validate provider configuration
   */
  async validate(config: ProviderConfig): Promise<boolean> {
    const result = await this.validateDetailed(config);
    return result.isValid;
  }

  /**
   * Validate provider configuration with detailed results
   */
  async validateDetailed(config: ProviderConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!config.providerId) {
        errors.push('Provider ID is required');
      }

      if (!config.providerName) {
        errors.push('Provider name is required');
      }

      if (!config.channel) {
        errors.push('Channel is required');
      }

      if (!config.config || typeof config.config !== 'object') {
        errors.push('Provider configuration object is required');
      }

      if (config.priority < 1) {
        errors.push('Priority must be greater than 0');
      }

      // Channel-specific validation
      if (config.channel && config.config) {
        const channelValidation = await this.validateChannelConfig(
          config.channel as unknown as Channel,
          config.providerId,
          config.config,
        );
        errors.push(...channelValidation.errors);
        warnings.push(...channelValidation.warnings);
      }

      // Rate limits validation
      if (config.rateLimits) {
        const rateLimitValidation = this.validateRateLimits(config.rateLimits);
        errors.push(...rateLimitValidation.errors);
        warnings.push(...rateLimitValidation.warnings);
      }

      // Health check configuration validation
      if (config.healthCheck) {
        const healthCheckValidation = this.validateHealthCheck(
          config.healthCheck,
        );
        errors.push(...healthCheckValidation.errors);
        warnings.push(...healthCheckValidation.warnings);
      }

      // Supported countries validation
      if (config.supportedCountries) {
        const countriesValidation = this.validateSupportedCountries(
          config.supportedCountries,
        );
        errors.push(...countriesValidation.errors);
        warnings.push(...countriesValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  /**
   * Validate channel-specific configuration
   */
  private async validateChannelConfig(
    channel: Channel,
    providerId: string,
    config: Record<string, any>,
  ): Promise<ValidationResult> {
    const schemaKey = `${channel}:${providerId}`;
    const schema = this.schemas.get(schemaKey) || this.schemas.get(channel);

    if (!schema) {
      return {
        isValid: true,
        errors: [],
        warnings: [`No validation schema found for ${channel}:${providerId}`],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const field of schema.required) {
      if (!config[field]) {
        errors.push(`Required field '${field}' is missing`);
      }
    }

    // Validate field values
    for (const [field, validator] of Object.entries(schema.validation)) {
      if (config[field] !== undefined && !validator(config[field])) {
        errors.push(`Invalid value for field '${field}'`);
      }
    }

    // Check for unknown fields
    const knownFields = [...schema.required, ...schema.optional];
    for (const field of Object.keys(config)) {
      if (!knownFields.includes(field)) {
        warnings.push(`Unknown field '${field}' in configuration`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate rate limits configuration
   */
  private validateRateLimits(rateLimits: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof rateLimits !== 'object') {
      errors.push('Rate limits must be an object');
      return { isValid: false, errors, warnings };
    }

    const validFields = [
      'requestsPerSecond',
      'requestsPerMinute',
      'requestsPerHour',
      'requestsPerDay',
    ];

    for (const [field, value] of Object.entries(rateLimits)) {
      if (!validFields.includes(field)) {
        warnings.push(`Unknown rate limit field: ${field}`);
        continue;
      }

      if (typeof value !== 'number' || value <= 0) {
        errors.push(`Rate limit '${field}' must be a positive number`);
      }
    }

    // Logical validation
    if (rateLimits.requestsPerSecond && rateLimits.requestsPerMinute) {
      if (rateLimits.requestsPerSecond * 60 > rateLimits.requestsPerMinute) {
        warnings.push(
          'Requests per second * 60 exceeds requests per minute limit',
        );
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate health check configuration
   */
  private validateHealthCheck(healthCheck: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof healthCheck !== 'object') {
      errors.push('Health check configuration must be an object');
      return { isValid: false, errors, warnings };
    }

    if (healthCheck.url && typeof healthCheck.url !== 'string') {
      errors.push('Health check URL must be a string');
    }

    if (
      healthCheck.interval &&
      (typeof healthCheck.interval !== 'number' || healthCheck.interval <= 0)
    ) {
      errors.push('Health check interval must be a positive number');
    }

    if (
      healthCheck.timeout &&
      (typeof healthCheck.timeout !== 'number' || healthCheck.timeout < 0)
    ) {
      errors.push('Health check timeout must be a non-negative number');
    }

    if (
      healthCheck.retries &&
      (typeof healthCheck.retries !== 'number' || healthCheck.retries < 0)
    ) {
      errors.push('Health check retries must be a non-negative number');
    }

    // Logical validation
    if (
      healthCheck.timeout &&
      healthCheck.interval &&
      healthCheck.timeout >= healthCheck.interval
    ) {
      warnings.push('Health check timeout should be less than interval');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate supported countries configuration
   */
  private validateSupportedCountries(countries: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(countries)) {
      errors.push('Supported countries must be an array');
      return { isValid: false, errors, warnings };
    }

    const validCountryCodes = this.getValidCountryCodes();

    for (const country of countries) {
      if (typeof country !== 'string') {
        errors.push('Country codes must be strings');
        continue;
      }

      if (country.length !== 2) {
        warnings.push(
          `Country code '${country}' should be 2 characters (ISO 3166-1 alpha-2)`,
        );
      }

      if (!validCountryCodes.includes(country.toUpperCase())) {
        warnings.push(`Unknown country code: ${country}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Initialize validation schemas for different providers
   */
  private initializeSchemas(): void {
    // AWS SES Email Provider
    this.schemas.set(`${Channel.EMAIL}:aws_ses`, {
      required: ['accessKeyId', 'secretAccessKey', 'region'],
      optional: ['fromEmail', 'fromName', 'replyToEmail'],
      validation: {
        accessKeyId: (value) => typeof value === 'string' && value.length > 0,
        secretAccessKey: (value) =>
          typeof value === 'string' && value.length > 0,
        region: (value) =>
          typeof value === 'string' && /^[a-z0-9-]+$/.test(value),
        fromEmail: (value) =>
          typeof value === 'string' && this.isValidEmail(value),
        replyToEmail: (value) =>
          typeof value === 'string' && this.isValidEmail(value),
      },
      description: {
        accessKeyId: 'AWS Access Key ID',
        secretAccessKey: 'AWS Secret Access Key',
        region: 'AWS Region (e.g., us-east-1)',
        fromEmail: 'Default sender email address',
        fromName: 'Default sender name',
        replyToEmail: 'Reply-to email address',
      },
    });

    // AWS SNS SMS Provider
    this.schemas.set(`${Channel.SMS}:aws_sns`, {
      required: ['accessKeyId', 'secretAccessKey', 'region'],
      optional: ['senderName', 'messageType'],
      validation: {
        accessKeyId: (value) => typeof value === 'string' && value.length > 0,
        secretAccessKey: (value) =>
          typeof value === 'string' && value.length > 0,
        region: (value) =>
          typeof value === 'string' && /^[a-z0-9-]+$/.test(value),
        senderName: (value) => typeof value === 'string' && value.length <= 11,
        messageType: (value) =>
          ['Promotional', 'Transactional'].includes(value),
      },
      description: {
        accessKeyId: 'AWS Access Key ID',
        secretAccessKey: 'AWS Secret Access Key',
        region: 'AWS Region',
        senderName: 'SMS sender name (max 11 characters)',
        messageType: 'Message type: Promotional or Transactional',
      },
    });

    // Termii SMS Provider
    this.schemas.set(`${Channel.SMS}:termii`, {
      required: ['apiKey', 'senderId'],
      optional: ['channel', 'type'],
      validation: {
        apiKey: (value) => typeof value === 'string' && value.length > 0,
        senderId: (value) => typeof value === 'string' && value.length <= 11,
        channel: (value) => ['generic', 'dnd', 'whatsapp'].includes(value),
        type: (value) => ['plain', 'unicode'].includes(value),
      },
      description: {
        apiKey: 'Termii API Key',
        senderId: 'Sender ID (max 11 characters)',
        channel: 'Message channel: generic, dnd, or whatsapp',
        type: 'Message type: plain or unicode',
      },
    });

    // AWS Pinpoint Push Provider
    this.schemas.set(`${Channel.PUSH}:aws_pinpoint`, {
      required: ['accessKeyId', 'secretAccessKey', 'region', 'applicationId'],
      optional: ['gcmApiKey', 'apnsCertificate', 'apnsPrivateKey'],
      validation: {
        accessKeyId: (value) => typeof value === 'string' && value.length > 0,
        secretAccessKey: (value) =>
          typeof value === 'string' && value.length > 0,
        region: (value) =>
          typeof value === 'string' && /^[a-z0-9-]+$/.test(value),
        applicationId: (value) => typeof value === 'string' && value.length > 0,
        gcmApiKey: (value) => typeof value === 'string' && value.length > 0,
      },
      description: {
        accessKeyId: 'AWS Access Key ID',
        secretAccessKey: 'AWS Secret Access Key',
        region: 'AWS Region',
        applicationId: 'Pinpoint Application ID',
        gcmApiKey: 'Google Cloud Messaging API Key',
        apnsCertificate: 'Apple Push Notification Certificate',
        apnsPrivateKey: 'Apple Push Notification Private Key',
      },
    });

    // WhatsApp Business Provider
    this.schemas.set(`${Channel.WHATSAPP}:whatsapp_business`, {
      required: ['accessToken', 'phoneNumberId', 'businessAccountId'],
      optional: ['webhookVerifyToken', 'apiVersion'],
      validation: {
        accessToken: (value) => typeof value === 'string' && value.length > 0,
        phoneNumberId: (value) =>
          typeof value === 'string' && /^\d+$/.test(value),
        businessAccountId: (value) =>
          typeof value === 'string' && /^\d+$/.test(value),
        apiVersion: (value) =>
          typeof value === 'string' && /^v\d+\.\d+$/.test(value),
      },
      description: {
        accessToken: 'WhatsApp Business API Access Token',
        phoneNumberId: 'Phone Number ID',
        businessAccountId: 'Business Account ID',
        webhookVerifyToken: 'Webhook Verification Token',
        apiVersion: 'API Version (e.g., v17.0)',
      },
    });
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get valid country codes (ISO 3166-1 alpha-2)
   */
  private getValidCountryCodes(): string[] {
    return [
      'AD',
      'AE',
      'AF',
      'AG',
      'AI',
      'AL',
      'AM',
      'AO',
      'AQ',
      'AR',
      'AS',
      'AT',
      'AU',
      'AW',
      'AX',
      'AZ',
      'BA',
      'BB',
      'BD',
      'BE',
      'BF',
      'BG',
      'BH',
      'BI',
      'BJ',
      'BL',
      'BM',
      'BN',
      'BO',
      'BQ',
      'BR',
      'BS',
      'BT',
      'BV',
      'BW',
      'BY',
      'BZ',
      'CA',
      'CC',
      'CD',
      'CF',
      'CG',
      'CH',
      'CI',
      'CK',
      'CL',
      'CM',
      'CN',
      'CO',
      'CR',
      'CU',
      'CV',
      'CW',
      'CX',
      'CY',
      'CZ',
      'DE',
      'DJ',
      'DK',
      'DM',
      'DO',
      'DZ',
      'EC',
      'EE',
      'EG',
      'EH',
      'ER',
      'ES',
      'ET',
      'FI',
      'FJ',
      'FK',
      'FM',
      'FO',
      'FR',
      'GA',
      'GB',
      'GD',
      'GE',
      'GF',
      'GG',
      'GH',
      'GI',
      'GL',
      'GM',
      'GN',
      'GP',
      'GQ',
      'GR',
      'GS',
      'GT',
      'GU',
      'GW',
      'GY',
      'HK',
      'HM',
      'HN',
      'HR',
      'HT',
      'HU',
      'ID',
      'IE',
      'IL',
      'IM',
      'IN',
      'IO',
      'IQ',
      'IR',
      'IS',
      'IT',
      'JE',
      'JM',
      'JO',
      'JP',
      'KE',
      'KG',
      'KH',
      'KI',
      'KM',
      'KN',
      'KP',
      'KR',
      'KW',
      'KY',
      'KZ',
      'LA',
      'LB',
      'LC',
      'LI',
      'LK',
      'LR',
      'LS',
      'LT',
      'LU',
      'LV',
      'LY',
      'MA',
      'MC',
      'MD',
      'ME',
      'MF',
      'MG',
      'MH',
      'MK',
      'ML',
      'MM',
      'MN',
      'MO',
      'MP',
      'MQ',
      'MR',
      'MS',
      'MT',
      'MU',
      'MV',
      'MW',
      'MX',
      'MY',
      'MZ',
      'NA',
      'NC',
      'NE',
      'NF',
      'NG',
      'NI',
      'NL',
      'NO',
      'NP',
      'NR',
      'NU',
      'NZ',
      'OM',
      'PA',
      'PE',
      'PF',
      'PG',
      'PH',
      'PK',
      'PL',
      'PM',
      'PN',
      'PR',
      'PS',
      'PT',
      'PW',
      'PY',
      'QA',
      'RE',
      'RO',
      'RS',
      'RU',
      'RW',
      'SA',
      'SB',
      'SC',
      'SD',
      'SE',
      'SG',
      'SH',
      'SI',
      'SJ',
      'SK',
      'SL',
      'SM',
      'SN',
      'SO',
      'SR',
      'SS',
      'ST',
      'SV',
      'SX',
      'SY',
      'SZ',
      'TC',
      'TD',
      'TF',
      'TG',
      'TH',
      'TJ',
      'TK',
      'TL',
      'TM',
      'TN',
      'TO',
      'TR',
      'TT',
      'TV',
      'TW',
      'TZ',
      'UA',
      'UG',
      'UM',
      'US',
      'UY',
      'UZ',
      'VA',
      'VC',
      'VE',
      'VG',
      'VI',
      'VN',
      'VU',
      'WF',
      'WS',
      'YE',
      'YT',
      'ZA',
      'ZM',
      'ZW',
    ];
  }
}
