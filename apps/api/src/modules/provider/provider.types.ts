import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProviderResponse } from "../../providers/types";

export interface ProviderSelectionOptions {
  tenantId: string;
  channel: NotificationChannel;
  country?: string;
  priority?: number;
  excludeProviders?: string[];
}

export interface ProviderSendResult {
  success: boolean;
  response?: ProviderResponse;
  error?: string;
  providerId: string;
  responseTime: number;
}
