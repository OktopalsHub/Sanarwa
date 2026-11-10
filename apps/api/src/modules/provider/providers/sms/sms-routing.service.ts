import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parsePhoneNumberWithError } from "libphonenumber-js";
import { ISMSProvider } from "./sms-provider.interface";

@Injectable()
export class SMSRoutingService {
  private readonly logger = new Logger(SMSRoutingService.name);
  private providers: ISMSProvider[] = [];
  private defaultProvider: string;

  constructor(private configService: ConfigService) {
    this.defaultProvider = this.configService.get("DEFAULT_SMS_PROVIDER") || "termii";
  }

  registerProvider(provider: ISMSProvider): void {
    this.providers.push(provider);
    this.logger.log(`Registered SMS provider: ${provider.getProviderName()}`);
  }

  /**
   * All registered providers, best first: supported-country providers ordered
   * by cost, then the rest with the env-configured default promoted ahead of
   * them. Callers that send should walk this list and skip providers whose
   * circuit is open instead of stopping at the first pick.
   */
  getPreferredProviders(phoneNumber: string): ISMSProvider[] {
    const ranked: ISMSProvider[] = [];

    try {
      const parsedNumber = parsePhoneNumberWithError(phoneNumber);

      if (parsedNumber?.isValid()) {
        const countryCode = parsedNumber.country as string;

        const supported = this.providers
          .map((provider) => {
            const supportedCountries = provider.getSupportedCountries();
            const supportedForCountry =
              supportedCountries.includes(countryCode) || supportedCountries.includes("*");

            return {
              provider,
              cost: supportedForCountry ? provider.getCostPerMessage(countryCode) : Infinity,
            };
          })
          .filter((entry) => entry.cost !== Infinity)
          .toSorted((a, b) => a.cost - b.cost);

        ranked.push(...supported.map((entry) => entry.provider));
      } else {
        this.logger.warn(`Invalid phone number: ${phoneNumber}`);
      }
    } catch (error) {
      this.logger.error(
        `Error ordering SMS providers for ${phoneNumber}: ${(error as Error).message}`,
      );
    }

    const defaultProvider =
      this.providers.find((provider) => provider.getProviderName() === this.defaultProvider) ??
      this.providers[0];
    const remainder = this.providers.filter((provider) => !ranked.includes(provider));
    remainder.sort((a, b) => {
      if (a === defaultProvider) return -1;
      if (b === defaultProvider) return 1;
      return 0;
    });

    return [...ranked, ...remainder];
  }

  getBestProvider(phoneNumber: string): ISMSProvider | null {
    const preferred = this.getPreferredProviders(phoneNumber);

    if (preferred.length === 0) {
      this.logger.error("No SMS providers available");
      return null;
    }

    this.logger.log(`Selected ${preferred[0].getProviderName()} for ${phoneNumber}`);
    return preferred[0];
  }

  getProviderByName(name: string): ISMSProvider | null {
    return this.providers.find((p) => p.getProviderName() === name) || null;
  }

  getDefaultProvider(): ISMSProvider | null {
    const defaultProvider = this.getProviderByName(this.defaultProvider);
    if (defaultProvider) {
      this.logger.log(`Using default SMS provider: ${this.defaultProvider}`);
      return defaultProvider;
    }

    if (this.providers.length > 0) {
      this.logger.warn(
        `Default provider '${this.defaultProvider}' not found, using first available: ${this.providers[0].getProviderName()}`,
      );
      return this.providers[0];
    }

    this.logger.error("No SMS providers available");
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
