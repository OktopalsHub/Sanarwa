import { IBaseProvider } from '../../../providers/base/base-provider.interface';
import { IProviderFactory } from '../../../providers/factory/provider-factory.interface';
import { Channel, ProviderConfig } from '../../../providers/types';
import { MockEmailProvider } from './mock-email-provider';
import { MockPushProvider } from './mock-push-provider';
import { MockSMSProvider } from './mock-sms-provider';
import { MockWhatsAppProvider } from './mock-whatsapp-provider';

export class MockProviderFactory implements IProviderFactory {
  private providers = new Map<string, any>();
  private shouldFailCreation = false;
  private failureMessage = 'Mock factory failure';

  constructor() {
    // Register default mock providers
    this.registerProvider('mock-email', Channel.EMAIL, MockEmailProvider);
    this.registerProvider('mock-sms', Channel.SMS, MockSMSProvider);
    this.registerProvider('mock-push', Channel.PUSH, MockPushProvider);
    this.registerProvider(
      'mock-whatsapp',
      Channel.WHATSAPP,
      MockWhatsAppProvider,
    );
  }

  registerProvider(
    providerId: string,
    channel: Channel,
    providerClass: any,
  ): void {
    const key = `${providerId}-${channel}`;
    this.providers.set(key, providerClass);
  }

  unregisterProvider(providerId: string, channel: Channel): boolean {
    const key = `${providerId}-${channel}`;
    return this.providers.delete(key);
  }

  isProviderRegistered(providerId: string, channel: Channel): boolean {
    const key = `${providerId}-${channel}`;
    return this.providers.has(key);
  }

  async createProvider(
    providerId: string,
    channel: Channel,
    config: ProviderConfig,
  ): Promise<IBaseProvider> {
    if (this.shouldFailCreation) {
      throw new Error(this.failureMessage);
    }

    const key = `${providerId}-${channel}`;
    const ProviderClass = this.providers.get(key);

    if (!ProviderClass) {
      throw new Error(
        `Provider ${providerId} for channel ${channel} is not registered`,
      );
    }

    const provider = new ProviderClass(config);
    await provider.initialize();
    return provider;
  }

  getAvailableProviders(channel: Channel): string[] {
    const providers: string[] = [];
    for (const [key, _] of this.providers) {
      const [providerId, providerChannel] = key.split('-');
      if (providerChannel === channel) {
        providers.push(providerId);
      }
    }
    return providers;
  }

  getAllRegisteredProviders(): Array<{ providerId: string; channel: Channel }> {
    const providers: Array<{ providerId: string; channel: Channel }> = [];
    for (const [key, _] of this.providers) {
      const [providerId, channel] = key.split('-');
      providers.push({ providerId, channel: channel as Channel });
    }
    return providers;
  }

  clearProviders(): void {
    this.providers.clear();
  }

  // Test helper methods
  setShouldFailCreation(shouldFail: boolean, message?: string): void {
    this.shouldFailCreation = shouldFail;
    if (message) {
      this.failureMessage = message;
    }
  }

  reset(): void {
    this.shouldFailCreation = false;
    this.failureMessage = 'Mock factory failure';
    this.clearProviders();

    // Re-register default providers
    this.registerProvider('mock-email', Channel.EMAIL, MockEmailProvider);
    this.registerProvider('mock-sms', Channel.SMS, MockSMSProvider);
    this.registerProvider('mock-push', Channel.PUSH, MockPushProvider);
    this.registerProvider(
      'mock-whatsapp',
      Channel.WHATSAPP,
      MockWhatsAppProvider,
    );
  }
}
