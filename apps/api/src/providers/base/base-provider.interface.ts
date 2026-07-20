import {
  Channel,
  ProviderConfig,
  ProviderHealthStatus,
  ProviderResponse,
} from '../types';

export interface BaseProviderPayload {
  recipient: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface IBaseProvider {
  readonly id: string;
  readonly name: string;
  readonly channel: Channel;
  readonly config: ProviderConfig;
  readonly isInitialized: boolean;

  /**
   * Send a notification through this provider
   */
  send(payload: BaseProviderPayload): Promise<ProviderResponse>;

  /**
   * Validate the provider configuration
   */
  validateConfig(config: ProviderConfig): Promise<boolean>;

  /**
   * Check the health status of the provider
   */
  checkHealth(): Promise<ProviderHealthStatus>;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Clean up resources when provider is destroyed
   */
  destroy(): Promise<void>;
}
