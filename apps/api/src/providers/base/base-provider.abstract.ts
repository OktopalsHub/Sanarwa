import { Logger } from "@nestjs/common";
import {
  Channel,
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from "../types";
import { BaseProviderPayload, IBaseProvider } from "./base-provider.interface";

export abstract class BaseProvider implements IBaseProvider {
  protected readonly logger: Logger;
  protected _config: ProviderConfig;
  protected _isInitialized = false;
  protected _lastHealthCheck?: Date;
  protected _healthStatus: ProviderHealth = ProviderHealth.UNKNOWN;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly channel: Channel,
  ) {
    this.logger = new Logger(`${this.constructor.name}:${this.id}`);
  }

  get config(): ProviderConfig {
    return this._config;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Abstract method to be implemented by concrete providers
   */
  abstract send(payload: BaseProviderPayload): Promise<ProviderResponse>;

  /**
   * Abstract method to validate provider-specific configuration
   */
  abstract validateConfig(config: ProviderConfig): Promise<boolean>;

  /**
   * Abstract method to perform provider-specific health check
   */
  protected abstract performHealthCheck(): Promise<ProviderHealthStatus>;

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.logger.log(`Initializing provider ${this.name} (${this.id})`);

    const isValid = await this.validateConfig(config);
    if (!isValid) {
      throw new Error(`Invalid configuration for provider ${this.name}`);
    }

    this._config = config;
    await this.onInitialize();
    this._isInitialized = true;

    this.logger.log(`Provider ${this.name} initialized successfully`);
  }

  /**
   * Check the health status of the provider
   */
  async checkHealth(): Promise<ProviderHealthStatus> {
    if (!this._isInitialized) {
      return {
        status: ProviderHealth.UNHEALTHY,
        lastChecked: new Date(),
        metadata: { error: "Provider not initialized" },
      };
    }

    try {
      const startTime = Date.now();
      const healthStatus = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      this._lastHealthCheck = new Date();
      this._healthStatus = healthStatus.status;

      return {
        ...healthStatus,
        responseTime,
        lastChecked: this._lastHealthCheck,
      };
    } catch (error) {
      this.logger.error(`Health check failed for provider ${this.name}:`, error);

      this._healthStatus = ProviderHealth.UNHEALTHY;
      this._lastHealthCheck = new Date();

      return {
        status: ProviderHealth.UNHEALTHY,
        lastChecked: this._lastHealthCheck,
        metadata: { error: error.message },
      };
    }
  }

  /**
   * Clean up resources when provider is destroyed
   */
  async destroy(): Promise<void> {
    this.logger.log(`Destroying provider ${this.name} (${this.id})`);
    await this.onDestroy();
    this._isInitialized = false;
    this.logger.log(`Provider ${this.name} destroyed`);
  }

  /**
   * Hook for provider-specific initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Override in concrete implementations if needed
  }

  /**
   * Hook for provider-specific cleanup logic
   */
  protected async onDestroy(): Promise<void> {
    // Override in concrete implementations if needed
  }

  /**
   * Create a standardized error response
   */
  protected createErrorResponse(error: string, messageId?: string): ProviderResponse {
    return {
      messageId: messageId || `error-${Date.now()}`,
      status: DeliveryStatus.FAILED,
      timestamp: new Date(),
      error,
    };
  }

  /**
   * Create a standardized success response
   */
  protected createSuccessResponse(
    messageId: string,
    providerMessageId?: string,
    metadata?: Record<string, any>,
  ): ProviderResponse {
    return {
      messageId,
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
      providerMessageId,
      metadata,
    };
  }

  /**
   * Validate common configuration fields
   */
  protected validateCommonConfig(config: ProviderConfig): boolean {
    if (!config.id || !config.name || !config.channel) {
      return false;
    }

    if (config.channel !== this.channel) {
      return false;
    }

    if (typeof config.priority !== "number" || config.priority < 0) {
      return false;
    }

    return true;
  }
}
