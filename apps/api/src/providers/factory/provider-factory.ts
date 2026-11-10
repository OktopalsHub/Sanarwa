import { Injectable, Logger } from "@nestjs/common";
import { IBaseProvider } from "../base/base-provider.interface";
import { ProviderConfig } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { IProviderFactory } from "./provider-factory.interface";

type ProviderConstructor = new (...args: any[]) => IBaseProvider;

@Injectable()
export class ProviderFactory implements IProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);
  private readonly providers = new Map<string, ProviderConstructor>();

  async createProvider(
    providerId: string,
    channel: NotificationChannel,
    config: ProviderConfig,
  ): Promise<IBaseProvider> {
    const providerKey = this.getProviderKey(providerId, channel);
    const ProviderClass = this.providers.get(providerKey);

    if (!ProviderClass) {
      throw new Error(`Provider ${providerId} for channel ${channel} is not registered`);
    }

    try {
      this.logger.log(`Creating provider instance: ${providerId} for channel ${channel}`);

      const provider = new ProviderClass(config.id, config.name, channel);

      await provider.initialize(config);

      this.logger.log(`Provider ${providerId} created and initialized successfully`);
      return provider;
    } catch (error) {
      this.logger.error(`Failed to create provider ${providerId}:`, error);
      throw new Error(`Failed to create provider ${providerId}: ${error.message}`, {
        cause: error,
      });
    }
  }

  getAvailableProviders(channel: NotificationChannel): string[] {
    const providers: string[] = [];

    for (const [key] of this.providers) {
      const [providerId, providerChannel] = key.split(":");
      if (providerChannel === channel) {
        providers.push(providerId);
      }
    }

    return providers;
  }

  registerProvider(
    providerId: string,
    channel: NotificationChannel,
    providerClass: ProviderConstructor,
  ): void {
    const providerKey = this.getProviderKey(providerId, channel);

    if (this.providers.has(providerKey)) {
      this.logger.warn(
        `Provider ${providerId} for channel ${channel} is already registered. Overwriting...`,
      );
    }

    this.providers.set(providerKey, providerClass);
    this.logger.log(`Registered provider: ${providerId} for channel ${channel}`);
  }

  isProviderRegistered(providerId: string, channel: NotificationChannel): boolean {
    const providerKey = this.getProviderKey(providerId, channel);
    return this.providers.has(providerKey);
  }

  getAllRegisteredProviders(): Array<{ providerId: string; channel: NotificationChannel }> {
    const result: Array<{ providerId: string; channel: NotificationChannel }> = [];

    for (const [key] of this.providers) {
      const [providerId, channel] = key.split(":");
      result.push({ providerId, channel: channel as NotificationChannel });
    }

    return result;
  }

  unregisterProvider(providerId: string, channel: NotificationChannel): boolean {
    const providerKey = this.getProviderKey(providerId, channel);
    const existed = this.providers.has(providerKey);

    if (existed) {
      this.providers.delete(providerKey);
      this.logger.log(`Unregistered provider: ${providerId} for channel ${channel}`);
    }

    return existed;
  }

  clearProviders(): void {
    this.providers.clear();
    this.logger.log("Cleared all registered providers");
  }

  private getProviderKey(providerId: string, channel: NotificationChannel): string {
    return `${providerId}:${channel}`;
  }
}
