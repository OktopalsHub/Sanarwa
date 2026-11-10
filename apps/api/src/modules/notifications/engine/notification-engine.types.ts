import { ChatProvider } from "../../../common/enums/chat-provider.enum";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

export interface NotificationEngineRequest {
  tenantId: string;
  projectId: string;
  channel: NotificationChannel;
  to: string;
  title?: string;
  message: string;
  variables?: Record<string, any>;
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date;
  expiresAt?: Date;
  templateId?: string;
  templateData?: Record<string, any>;
  trackingId?: string;
  webhookUrl?: string;
  brandId?: string;
  subscriberId?: string;
  chatProvider?: ChatProvider;
  metadata?: Record<string, any>;
}

export interface NotificationEngineResponse {
  id: string;
  trackingId: string;
  messageId?: string;
  deliveryId?: string;
  status: "queued" | "sent" | "delivered" | "failed";
  externalId?: string;
  error?: string;
  timestamp: Date;
}
