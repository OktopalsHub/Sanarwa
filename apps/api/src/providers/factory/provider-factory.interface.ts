import { IBaseProvider } from "../base/base-provider.interface";
import { ProviderConfig } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export interface IProviderFactory {
  createProvider(
    providerId: string,
    channel: NotificationChannel,
    config: ProviderConfig,
  ): Promise<IBaseProvider>;

  getAvailableProviders(channel: NotificationChannel): string[];

  registerProvider(
    providerId: string,
    channel: NotificationChannel,
    providerClass: new (...args: any[]) => IBaseProvider,
  ): void;

  isProviderRegistered(providerId: string, channel: NotificationChannel): boolean;
}
