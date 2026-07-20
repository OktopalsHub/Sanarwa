import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePhoneNumberWithError, CountryCode, } from 'libphonenumber-js';
import { ISMSProvider } from './sms-provider.interface';

interface ProviderCost {
  provider: ISMSProvider;
  cost: number;
  supported: boolean;
}

@Injectable()
export class SMSRoutingService {
  private readonly logger = new Logger(SMSRoutingService.name);
  private providers: ISMSProvider[] = [];
  private defaultProvider: string;

  constructor(private configService: ConfigService) {
    this.defaultProvider = this.configService.get('DEFAULT_SMS_PROVIDER') || 'termii';
  }

  registerProvider(provider: ISMSProvider): void {
    this.providers.push(provider);
    this.logger.log(`Registered SMS provider: ${provider.getProviderName()}`);
  }

  getBestProvider(phoneNumber: string): ISMSProvider | null {
    try {
      const parsedNumber = parsePhoneNumberWithError(phoneNumber);

      if (!parsedNumber || !parsedNumber.isValid()) {
        this.logger.warn(`Invalid phone number: ${phoneNumber}`);
        return this.getDefaultProvider(); // Return default for invalid numbers
      }

      const countryCode = parsedNumber.country as string;

      // Get all providers that support this country with their costs
      const availableProviders: ProviderCost[] = this.providers.map(provider => {
        const supportedCountries = provider.getSupportedCountries();
        const supported = supportedCountries.includes(countryCode) || supportedCountries.includes('*');
        const cost = supported ? provider.getCostPerMessage(countryCode) : Infinity;

        return {
          provider,
          cost,
          supported,
        };
      });

      // Filter supported providers and sort by cost (ascending)
      const supportedProviders = availableProviders
        .filter(p => p.supported)
        .toSorted((a, b) => a.cost - b.cost);

      if (supportedProviders.length === 0) {
        this.logger.warn(`No SMS provider supports country: ${countryCode}, using default provider`);
        return this.getDefaultProvider();
      }

      const bestProvider = supportedProviders[0];
      this.logger.log(
        `Selected ${bestProvider.provider.getProviderName()} for ${countryCode} (cost: $${bestProvider.cost})`
      );

      return bestProvider.provider;
    } catch (error) {
      this.logger.error(`Error selecting SMS provider: ${error.message}`, error.stack);
      return this.getDefaultProvider(); // Fallback to default provider
    }
  }

  getProviderByName(name: string): ISMSProvider | null {
    return this.providers.find(p => p.getProviderName() === name) || null;
  }

  getDefaultProvider(): ISMSProvider | null {
    const defaultProvider = this.getProviderByName(this.defaultProvider);
    if (defaultProvider) {
      this.logger.log(`Using default SMS provider: ${this.defaultProvider}`);
      return defaultProvider;
    }

    // If default provider not found, use first available
    if (this.providers.length > 0) {
      this.logger.warn(`Default provider '${this.defaultProvider}' not found, using first available: ${this.providers[0].getProviderName()}`);
      return this.providers[0];
    }

    this.logger.error('No SMS providers available');
    return null;
  }

  getAllProviders(): ISMSProvider[] {
    return [...this.providers];
  }

  async validatePhoneNumber(phoneNumber: string): Promise<{
    isValid: boolean;
    country?: string;
    nationalNumber?: string;
    internationalFormat?: string;
  }> {
    try {
      const parsedNumber = parsePhoneNumberWithError(phoneNumber);

      if (!parsedNumber || !parsedNumber.isValid()) {
        return { isValid: false };
      }

      return {
        isValid: true,
        country: parsedNumber.country,
        nationalNumber: parsedNumber.nationalNumber,
        internationalFormat: parsedNumber.formatInternational(),
      };
    } catch (error) {
      this.logger.error(`Phone number validation error: ${error.message}`);
      return { isValid: false };
    }
  }
}