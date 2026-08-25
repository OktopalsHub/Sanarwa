export type NotificationChannel = "email" | "sms" | "push" | "whatsapp" | "webhook" | "in_app";

export interface NotificationEngineRequest {
  tenantId: string;
  projectId: string;
  channel: NotificationChannel;
  to: string;
  title?: string;
  message: string;
  data?: Record<string, any>;
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date;
  expiresAt?: Date;
  templateId?: string;
  templateData?: Record<string, any>;
  trackingId?: string;
  webhookUrl?: string;
  brandId?: string;
  subscriberId?: string;
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

export interface MessagingEngineRequest {
  tenantId: string;
  projectId: string;
  channels: string[];
  recipients: Array<{
    id: string;
    email?: string;
    phone?: string;
    deviceToken?: string;
    whatsappNumber?: string;
    userId?: string;
    subscriberId?: string;
    metadata?: Record<string, any>;
  }>;
  subject?: string;
  content?: string;
  data?: Record<string, any>;
  templateId?: string;
  priority?: string;
  brandId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}
