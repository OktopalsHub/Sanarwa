import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export enum DeliveryStatus {
  SENT = "sent",
  FAILED = "failed",
}

export interface Recipient {
  id: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  whatsappNumber?: string;
  voiceNumber?: string;
  metadata?: Record<string, any>;
}

export interface ProviderResponse {
  messageId: string;
  status: DeliveryStatus;
  timestamp: Date;
  providerMessageId?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  channel: NotificationChannel;
  priority: number;
  isActive: boolean;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}
