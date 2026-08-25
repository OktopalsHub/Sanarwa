import { IBaseProvider } from "../base/base-provider.interface";
import { Channel, ProviderConfig } from "../types";

export interface IProviderFactory {
  /**
   * Create a provider instance
   */
  createProvider(
    providerId: string,
    channel: Channel,
    config: ProviderConfig,
  ): Promise<IBaseProvider>;

  /**
   * Get available provider types for a channel
   */
  getAvailableProviders(channel: Channel): string[];

  /**
   * Register a new provider type
   */
  registerProvider(
    providerId: string,
    channel: Channel,
    providerClass: new (...args: any[]) => IBaseProvider,
  ): void;

  /**
   * Check if a provider type is registered
   */
  isProviderRegistered(providerId: string, channel: Channel): boolean;
}
