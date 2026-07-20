import { Injectable, Logger } from '@nestjs/common';
import { IBaseProvider } from '../base/base-provider.interface';
import { Channel, ProviderConfig } from '../types';
import { IProviderFactory } from './provider-factory.interface';

type ProviderConstructor = new (...args: any[]) => IBaseProvider;

@Injectable()
export class ProviderFactory implements IProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);
  private readonly providers = new Map<string, ProviderConstructor>();

  /**
   * Create a provider instance
   */
  async createProvider(
    providerId: string,
    channel: Channel,
    config: ProviderConfig,
  ): Promise<IBaseProvider> {
    const providerKey = this.getProviderKey(providerId, channel);
    const ProviderClass = this.providers.get(providerKey);

    if (!ProviderClass) {
      throw new Error(
        `Provider ${providerId} for channel ${channel} is not registered`,
      );
    }

    try {
      this.logger.log(
        `Creating provider instance: ${providerId} for channel ${channel}`,
      );

      // Create provider instance with basic parameters
      const provider = new ProviderClass(config.id, config.name, channel);

      // Initialize the provider with configuration
      await provider.initialize(config);

      this.logger.log(
        `Provider ${providerId} created and initialized successfully`,
      );
      return provider;
    } catch (error) {
      this.logger.error(`Failed to create provider ${providerId}:`, error);
      throw new Error(
        `Failed to create provider ${providerId}: ${error.message}`,
      );
    }
  }

  /**
   * Get available provider types for a channel
   */
  getAvailableProviders(channel: Channel): string[] {
    const providers: string[] = [];

    for (const [key] of this.providers) {
      const [providerId, providerChannel] = key.split(':');
      if (providerChannel === channel) {
        providers.push(providerId);
      }
    }

    return providers;
  }

  /**
   * Register a new provider type
   */
  registerProvider(
    providerId: string,
    channel: Channel,
    providerClass: ProviderConstructor,
  ): void {
    const providerKey = this.getProviderKey(providerId, channel);

    if (this.providers.has(providerKey)) {
      this.logger.warn(
        `Provider ${providerId} for channel ${channel} is already registered. Overwriting...`,
      );
    }

    this.providers.set(providerKey, providerClass);
    this.logger.log(
      `Registered provider: ${providerId} for channel ${channel}`,
    );
  }

  /**
   * Check if a provider type is registered
   */
  isProviderRegistered(providerId: string, channel: Channel): boolean {
    const providerKey = this.getProviderKey(providerId, channel);
    return this.providers.has(providerKey);
  }

  /**
   * Get all registered providers
   */
  getAllRegisteredProviders(): Array<{ providerId: string; channel: Channel }> {
    const result: Array<{ providerId: string; channel: Channel }> = [];

    for (const [key] of this.providers) {
      const [providerId, channel] = key.split(':');
      result.push({ providerId, channel: channel as Channel });
    }

    return result;
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string, channel: Channel): boolean {
    const providerKey = this.getProviderKey(providerId, channel);
    const existed = this.providers.has(providerKey);

    if (existed) {
      this.providers.delete(providerKey);
      this.logger.log(
        `Unregistered provider: ${providerId} for channel ${channel}`,
      );
    }

    return existed;
  }

  /**
   * Clear all registered providers
   */
  clearProviders(): void {
    this.providers.clear();
    this.logger.log('Cleared all registered providers');
  }

  /**
   * Generate a unique key for provider registration
   */
  private getProviderKey(providerId: string, channel: Channel): string {
    return `${providerId}:${channel}`;
  }
}
