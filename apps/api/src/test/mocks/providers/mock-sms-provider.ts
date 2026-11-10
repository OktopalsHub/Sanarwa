import { ISMSProvider } from "../../../providers/sms/sms-provider.interface";
import { DeliveryStatus, ProviderConfig, ProviderResponse } from "../../../providers/types";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

export class MockSMSProvider implements ISMSProvider {
  id = "mock-sms-provider";
  name = "Mock SMS Provider";
  channel = NotificationChannel.SMS;
  config: ProviderConfig;
  isInitialized = true;

  private shouldFail = false;
  private failureMessage = "Mock SMS provider failure";
  private responseDelay = 0;
  private supportedCountries = ["US", "CA", "GB", "NG", "KE"];

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async send(payload: any): Promise<ProviderResponse> {
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    return {
      messageId: "mock-sms-" + Math.random().toString(36).substr(2, 9),
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
      providerMessageId: "mock-sms-message-id",
      metadata: {
        cost: 0.05,
      },
    };
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return config && config.credentials && typeof config.credentials === "object";
  }

  getSupportedCountries(): string[] {
    return this.supportedCountries;
  }

  isCountrySupported(countryCode: string): boolean {
    return this.supportedCountries.includes(countryCode.toUpperCase());
  }

  formatPhoneNumber(phoneNumber: string, countryCode?: string): string {
    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    if (countryCode) {
      const countryCodeMap: Record<string, string> = {
        US: "+1",
        CA: "+1",
        GB: "+44",
        NG: "+234",
        KE: "+254",
      };

      const prefix = countryCodeMap[countryCode.toUpperCase()] || "+1";
      return `${prefix}${phoneNumber}`;
    }

    return `+1${phoneNumber}`;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
  }

  setShouldFail(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) {
      this.failureMessage = message;
    }
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  setSupportedCountries(countries: string[]): void {
    this.supportedCountries = countries;
  }

  reset(): void {
    this.shouldFail = false;
    this.failureMessage = "Mock SMS provider failure";
    this.responseDelay = 0;
    this.supportedCountries = ["US", "CA", "GB", "NG", "KE"];
  }
}
