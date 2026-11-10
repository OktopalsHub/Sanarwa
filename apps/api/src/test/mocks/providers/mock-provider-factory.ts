import { IBaseProvider } from "../../../providers/base/base-provider.interface";
import { IProviderFactory } from "../../../providers/factory/provider-factory.interface";
import { ProviderConfig } from "../../../providers/types";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { MockEmailProvider } from "./mock-email-provider";
import { MockPushProvider } from "./mock-push-provider";
import { MockSMSProvider } from "./mock-sms-provider";
import { MockWhatsAppProvider } from "./mock-whatsapp-provider";

export class MockProviderFactory implements IProviderFactory {
  private providers = new Map<string, any>();
  private shouldFailCreation = false;
  private failureMessage = "Mock factory failure";

  constructor() {
    this.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
    this.registerProvider("mock-sms", NotificationChannel.SMS, MockSMSProvider);
    this.registerProvider("mock-push", NotificationChannel.PUSH, MockPushProvider);
    this.registerProvider("mock-whatsapp", NotificationChannel.WHATSAPP, MockWhatsAppProvider);
  }

  registerProvider(providerId: string, channel: NotificationChannel, providerClass: any): void {
    const key = `${providerId}-${channel}`;
    this.providers.set(key, providerClass);
  }

  unregisterProvider(providerId: string, channel: NotificationChannel): boolean {
    const key = `${providerId}-${channel}`;
    return this.providers.delete(key);
  }

  isProviderRegistered(providerId: string, channel: NotificationChannel): boolean {
    const key = `${providerId}-${channel}`;
    return this.providers.has(key);
  }

  async createProvider(
    providerId: string,
    channel: NotificationChannel,
    config: ProviderConfig,
  ): Promise<IBaseProvider> {
    if (this.shouldFailCreation) {
      throw new Error(this.failureMessage);
    }

    const key = `${providerId}-${channel}`;
    const ProviderClass = this.providers.get(key);

    if (!ProviderClass) {
      throw new Error(`Provider ${providerId} for channel ${channel} is not registered`);
    }

    const provider = new ProviderClass(config);
    await provider.initialize();
    return provider;
  }

  getAvailableProviders(channel: NotificationChannel): string[] {
    const providers: string[] = [];
    for (const [key, _] of this.providers) {
      const [providerId, providerChannel] = key.split("-");
      if (providerChannel === channel) {
        providers.push(providerId);
      }
    }
    return providers;
  }

  getAllRegisteredProviders(): Array<{ providerId: string; channel: NotificationChannel }> {
    const providers: Array<{ providerId: string; channel: NotificationChannel }> = [];
    for (const [key, _] of this.providers) {
      const [providerId, channel] = key.split("-");
      providers.push({ providerId, channel: channel as NotificationChannel });
    }
    return providers;
  }

  clearProviders(): void {
    this.providers.clear();
  }

  setShouldFailCreation(shouldFail: boolean, message?: string): void {
    this.shouldFailCreation = shouldFail;
    if (message) {
      this.failureMessage = message;
    }
  }

  reset(): void {
    this.shouldFailCreation = false;
    this.failureMessage = "Mock factory failure";
    this.clearProviders();

    this.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
    this.registerProvider("mock-sms", NotificationChannel.SMS, MockSMSProvider);
    this.registerProvider("mock-push", NotificationChannel.PUSH, MockPushProvider);
    this.registerProvider("mock-whatsapp", NotificationChannel.WHATSAPP, MockWhatsAppProvider);
  }
}
