import { EmailProviderType, ProviderHealthStatus, ProviderStatus, ProviderType, PushProviderType, SmsProviderType, WhatsAppProviderType } from "./enums";

export interface Provider {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: ProviderType;
  subtype: string; // EmailProviderType | SmsProviderType | etc.
  status: ProviderStatus;
  priority: number;
  isDefault: boolean;
  config: ProviderConfig;
  healthStatus: ProviderHealthStatus;
  lastHealthCheck?: Date;
  lastUsed?: Date;
  usageCount: number;
  errorCount: number;
  successRate: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;

  // Relationships
  tenant?: any; // Will be typed in tenant.ts
}

// Provider configuration base interface
export interface ProviderConfig {
  // Common configuration
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };

  // Provider-specific configuration (discriminated union)
  credentials:
    | EmailProviderConfig
    | SmsProviderConfig
    | PushProviderConfig
    | WhatsAppProviderConfig
    | WebhookProviderConfig;
}

// Email provider configurations
export interface EmailProviderConfig {
  type: EmailProviderType;
  config: AwsSesConfig | SendGridConfig | MailgunConfig | PostmarkConfig | SmtpConfig;
}

export interface AwsSesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  configurationSet?: string;
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  templateId?: string;
}

export interface MailgunConfig {
  domain: string;
  apiKey: string;
  region?: "us" | "eu";
  fromEmail: string;
  fromName?: string;
}

export interface PostmarkConfig {
  serverToken: string;
  fromEmail: string;
  fromName?: string;
  messageStream?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
}

// SMS provider configurations
export interface SmsProviderConfig {
  type: SmsProviderType;
  config: TwilioSmsConfig | AwsSnsConfig | TermiiConfig | NexmoConfig | MessageBirdSmsConfig;
}

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid?: string;
}

export interface AwsSnsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  senderId?: string;
  messageType?: "Promotional" | "Transactional";
}

export interface TermiiConfig {
  apiKey: string;
  senderId: string;
  channel?: "generic" | "dnd" | "whatsapp";
}

export interface NexmoConfig {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
}

export interface MessageBirdSmsConfig {
  accessKey: string;
  originator: string;
}

// Push notification provider configurations
export interface PushProviderConfig {
  type: PushProviderType;
  config: FirebaseConfig | AwsPinpointConfig | ApnsConfig | FcmConfig | OneSignalConfig;
}

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseURL?: string;
}

export interface AwsPinpointConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  applicationId: string;
}

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  production: boolean;
}

export interface FcmConfig {
  serverKey: string;
  senderId: string;
}

export interface OneSignalConfig {
  appId: string;
  restApiKey: string;
}

// WhatsApp provider configurations
export interface WhatsAppProviderConfig {
  type: WhatsAppProviderType;
  config: WhatsAppBusinessConfig | TwilioWhatsAppConfig | MessageBirdWhatsAppConfig;
}

export interface WhatsAppBusinessConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken?: string;
}

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface MessageBirdWhatsAppConfig {
  accessKey: string;
  channelId: string;
}

// Webhook provider configuration
export interface WebhookProviderConfig {
  type: "webhook";
  config: WebhookConfig;
}

export interface WebhookConfig {
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  authentication?: {
    type: "bearer" | "basic" | "api_key";
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
}
