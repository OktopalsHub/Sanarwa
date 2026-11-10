import { ProviderConfig, ProviderResponse } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export interface BaseProviderPayload {
  recipient: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface IBaseProvider {
  readonly id: string;
  readonly name: string;
  readonly channel: NotificationChannel;
  readonly config: ProviderConfig;
  readonly isInitialized: boolean;

  send(payload: BaseProviderPayload): Promise<ProviderResponse>;

  validateConfig(config: ProviderConfig): Promise<boolean>;

  initialize(config: ProviderConfig): Promise<void>;

  destroy(): Promise<void>;
}
