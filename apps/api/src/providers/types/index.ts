export enum Channel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WHATSAPP = "whatsapp",
  IN_APP = "in_app",
  VOICE = "voice",
}

export enum DeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  OPENED = "opened",
  CLICKED = "clicked",
}

export enum ProviderHealth {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
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
  channel: Channel;
  priority: number;
  isActive: boolean;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}

export interface ProviderHealthStatus {
  status: ProviderHealth;
  lastChecked: Date;
  responseTime?: number;
  errorRate?: number;
  uptime?: number;
  metadata?: Record<string, any>;
}
