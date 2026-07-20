import { Injectable, Logger } from '@nestjs/common';
import { ISMSProvider } from './sms-provider.interface';

export interface SMSRoutingRule {
  countryCode: string;
  providerId: string;
  priority: number;
  isActive: boolean;
}

export interface SMSProviderMapping {
  providerId: string;
  provider: ISMSProvider;
  supportedCountries: string[];
}

@Injectable()
export class SMSRoutingService {
  private readonly logger = new Logger(SMSRoutingService.name);
  private readonly providerMappings = new Map<string, SMSProviderMapping>();
  private readonly routingRules = new Map<string, SMSRoutingRule[]>();

  /**
   * Register an SMS provider with its supported countries
   */
  registerProvider(providerId: string, provider: ISMSProvider): void {
    const supportedCountries = provider.getSupportedCountries();

    this.providerMappings.set(providerId, {
      providerId,
      provider,
      supportedCountries,
    });

    this.logger.log(
      `Registered SMS provider ${providerId} with ${supportedCountries.length} supported countries`,
    );
  }

  /**
   * Unregister an SMS provider
   */
  unregisterProvider(providerId: string): void {
    this.providerMappings.delete(providerId);
    this.logger.log(`Unregistered SMS provider ${providerId}`);
  }

  /**
   * Set routing rules for a country
   */
  setCountryRouting(countryCode: string, rules: SMSRoutingRule[]): void {
    // Sort rules by priority (lower number = higher priority)
    const sortedRules = rules
      .filter((rule) => rule.isActive)
      .toSorted((a, b) => a.priority - b.priority);

    this.routingRules.set(countryCode.toUpperCase(), sortedRules);
    this.logger.log(
      `Set routing rules for country ${countryCode}: ${sortedRules.length} active rules`,
    );
  }

  /**
   * Get the best provider for a country
   */
  getProviderForCountry(countryCode: string): ISMSProvider | null {
    if (!countryCode) {
      this.logger.warn('No country code provided for SMS routing');
      return null;
    }

    const upperCountryCode = countryCode.toUpperCase();

    // Check if we have specific routing rules for this country
    const rules = this.routingRules.get(upperCountryCode);
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const mapping = this.providerMappings.get(rule.providerId);
        if (mapping && mapping.provider.isCountrySupported(upperCountryCode)) {
          this.logger.debug(
            `Using provider ${rule.providerId} for country ${countryCode} (priority: ${rule.priority})`,
          );
          return mapping.provider;
        }
      }
    }

    // Fallback: find any provider that supports this country
    for (const [providerId, mapping] of this.providerMappings) {
      if (mapping.provider.isCountrySupported(upperCountryCode)) {
        this.logger.debug(
          `Using fallback provider ${providerId} for country ${countryCode}`,
        );
        return mapping.provider;
      }
    }

    this.logger.warn(`No SMS provider found for country ${countryCode}`);
    return null;
  }

  /**
   * Get all providers that support a country
   */
  getProvidersForCountry(countryCode: string): ISMSProvider[] {
    const upperCountryCode = countryCode.toUpperCase();
    const providers: ISMSProvider[] = [];

    for (const [, mapping] of this.providerMappings) {
      if (mapping.provider.isCountrySupported(upperCountryCode)) {
        providers.push(mapping.provider);
      }
    }

    return providers;
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): ISMSProvider | null {
    const mapping = this.providerMappings.get(providerId);
    return mapping ? mapping.provider : null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): ISMSProvider[] {
    return Array.from(this.providerMappings.values()).map(
      (mapping) => mapping.provider,
    );
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): any {
    const stats = {
      totalProviders: this.providerMappings.size,
      totalCountriesWithRules: this.routingRules.size,
      providerCoverage: {} as Record<string, number>,
      countryCoverage: {} as Record<string, string[]>,
    };

    // Calculate provider coverage
    for (const [providerId, mapping] of this.providerMappings) {
      stats.providerCoverage[providerId] = mapping.supportedCountries.length;
    }

    // Calculate country coverage
    const allCountries = new Set<string>();
    for (const [, mapping] of this.providerMappings) {
      mapping.supportedCountries.forEach((country) => {
        allCountries.add(country);
        if (!stats.countryCoverage[country]) {
          stats.countryCoverage[country] = [];
        }
        stats.countryCoverage[country].push(mapping.providerId);
      });
    }

    return stats;
  }

  /**
   * Extract country code from phone number
   */
  extractCountryCodeFromPhone(phoneNumber: string): string | null {
    if (!phoneNumber.startsWith('+')) {
      return null;
    }

    // Common country code mappings
    const countryCodeMap: Record<string, string> = {
      // North America
      '1': 'US',
      // Europe
      '44': 'GB',
      '33': 'FR',
      '49': 'DE',
      '39': 'IT',
      '34': 'ES',
      '31': 'NL',
      '32': 'BE',
      '41': 'CH',
      '43': 'AT',
      '45': 'DK',
      '46': 'SE',
      '47': 'NO',
      '358': 'FI',
      '353': 'IE',
      '351': 'PT',
      // Asia
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
      // Africa
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
      // Middle East
      '966': 'SA',
      '971': 'AE',
      '974': 'QA',
      '973': 'BH',
      '965': 'KW',
      '968': 'OM',
      '967': 'YE',
      '962': 'JO',
      '961': 'LB',
      '972': 'IL',
      // Others
      '61': 'AU',
      '64': 'NZ',
      '55': 'BR',
      '52': 'MX',
      '54': 'AR',
    };

    // Try different lengths of country codes (1-3 digits)
    for (let i = 1; i <= 3; i++) {
      const code = phoneNumber.substring(1, 1 + i);
      if (countryCodeMap[code]) {
        return countryCodeMap[code];
      }
    }

    return null;
  }

  /**
   * Set default routing rules based on provider capabilities
   */
  setupDefaultRouting(): void {
    this.logger.log('Setting up default SMS routing rules...');

    // African countries -> Termii
    const africanCountries = [
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
    ];

    africanCountries.forEach((country) => {
      this.setCountryRouting(country, [
        {
          countryCode: country,
          providerId: 'termii',
          priority: 1,
          isActive: true,
        },
        {
          countryCode: country,
          providerId: 'sns',
          priority: 2,
          isActive: true,
        },
      ]);
    });

    // Asian countries -> Asia SMS Provider
    const asianCountries = [
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
    ];

    asianCountries.forEach((country) => {
      this.setCountryRouting(country, [
        {
          countryCode: country,
          providerId: 'asia-sms',
          priority: 1,
          isActive: true,
        },
        {
          countryCode: country,
          providerId: 'sns',
          priority: 2,
          isActive: true,
        },
      ]);
    });

    // Other countries -> SNS as primary
    const otherCountries = [
      'US',
      'CA',
      'GB',
      'DE',
      'FR',
      'IT',
      'ES',
      'AU',
      'BR',
      'MX',
    ];

    otherCountries.forEach((country) => {
      this.setCountryRouting(country, [
        {
          countryCode: country,
          providerId: 'sns',
          priority: 1,
          isActive: true,
        },
      ]);
    });

    this.logger.log('Default SMS routing rules configured');
  }

  /**
   * Validate routing configuration
   */
  validateRouting(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if all routing rules reference valid providers
    for (const [countryCode, rules] of this.routingRules) {
      for (const rule of rules) {
        if (!this.providerMappings.has(rule.providerId)) {
          errors.push(
            `Country ${countryCode} references unknown provider: ${rule.providerId}`,
          );
        }
      }
    }

    // Check for countries without any provider support
    const allSupportedCountries = new Set<string>();
    for (const [, mapping] of this.providerMappings) {
      mapping.supportedCountries.forEach((country) =>
        allSupportedCountries.add(country),
      );
    }

    const countriesWithRules = new Set(this.routingRules.keys());
    const unsupportedCountries = Array.from(countriesWithRules).filter(
      (country) => !allSupportedCountries.has(country),
    );

    if (unsupportedCountries.length > 0) {
      errors.push(
        `Countries with routing rules but no provider support: ${unsupportedCountries.join(', ')}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
