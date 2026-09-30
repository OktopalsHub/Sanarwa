import { BaseProviderPayload, IBaseProvider } from "../base/base-provider.interface";

export interface SMSPayload extends BaseProviderPayload {
  recipient: string; // phone number in E.164 format
  message: string;
  from?: string; // sender ID or phone number
  countryCode?: string;
}

export interface SMSConfig {
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  region?: string;
  supportedCountries?: string[];
  customSettings?: Record<string, any>;
}

export interface ISMSProvider extends IBaseProvider {
  send(payload: SMSPayload): Promise<import("../types").ProviderResponse>;

  /**
   * Get list of countries supported by this provider
   */
  getSupportedCountries(): string[];

  /**
   * Check if a country is supported by this provider
   */
  isCountrySupported(countryCode: string): boolean;

  /**
   * Format phone number for this provider
   */
  formatPhoneNumber(phoneNumber: string, countryCode?: string): string;
}
