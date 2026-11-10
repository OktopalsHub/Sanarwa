import { Logger } from "@nestjs/common";
import { DeliveryStatus, ProviderConfig, ProviderResponse } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProviderPayload, IBaseProvider } from "./base-provider.interface";

export abstract class BaseProvider implements IBaseProvider {
  protected readonly logger: Logger;
  protected _config: ProviderConfig;
  protected _isInitialized = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly channel: NotificationChannel,
  ) {
    this.logger = new Logger(`${this.constructor.name}:${this.id}`);
  }

  get config(): ProviderConfig {
    return this._config;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  abstract send(payload: BaseProviderPayload): Promise<ProviderResponse>;

  abstract validateConfig(config: ProviderConfig): Promise<boolean>;

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

  async destroy(): Promise<void> {
    this.logger.log(`Destroying provider ${this.name} (${this.id})`);
    await this.onDestroy();
    this._isInitialized = false;
    this.logger.log(`Provider ${this.name} destroyed`);
  }

  protected async onInitialize(): Promise<void> {}

  protected async onDestroy(): Promise<void> {}

  protected createErrorResponse(error: string, messageId?: string): ProviderResponse {
    return {
      messageId: messageId || `error-${Date.now()}`,
      status: DeliveryStatus.FAILED,
      timestamp: new Date(),
      error,
    };
  }

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
