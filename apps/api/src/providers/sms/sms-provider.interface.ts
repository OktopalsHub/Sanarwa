import { BaseProviderPayload, IBaseProvider } from "../base/base-provider.interface";

export interface SMSPayload extends BaseProviderPayload {
  recipient: string;
  message: string;
  from?: string;
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

  getSupportedCountries(): string[];

  isCountrySupported(countryCode: string): boolean;

  formatPhoneNumber(phoneNumber: string, countryCode?: string): string;
}
