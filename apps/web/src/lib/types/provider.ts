export enum ProviderType {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WHATSAPP = "whatsapp",
  WEBHOOK = "webhook",
  VOICE = "voice",
}

enum ProviderStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  TESTING = "testing",
  ERROR = "error",
  MAINTENANCE = "maintenance",
}

enum ProviderHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

enum EmailProviderType {
  AWS_SES = "aws_ses",
  SENDGRID = "sendgrid",
  MAILGUN = "mailgun",
  POSTMARK = "postmark",
  SMTP = "smtp",
}

enum SmsProviderType {
  TWILIO = "twilio",
  AWS_SNS = "aws_sns",
  TERMII = "termii",
  NEXMO = "nexmo",
  MESSAGEBIRD = "messagebird",
}

enum PushProviderType {
  FIREBASE = "firebase",
  AWS_PINPOINT = "aws_pinpoint",
  APNS = "apns",
  FCM = "fcm",
  ONESIGNAL = "onesignal",
}

enum WhatsAppProviderType {
  WHATSAPP_BUSINESS = "whatsapp_business",
  TWILIO_WHATSAPP = "twilio_whatsapp",
  MESSAGEBIRD_WHATSAPP = "messagebird_whatsapp",
}

export interface Provider {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: ProviderType;
  subtype: string;
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

  tenant?: any;
}

export interface ProviderConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };

  credentials:
    | EmailProviderConfig
    | SmsProviderConfig
    | PushProviderConfig
    | WhatsAppProviderConfig
    | WebhookProviderConfig;
}

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

export interface PushProviderConfig {
  type: PushProviderType;
  config: FirebaseConfig | AwsPinpointConfig | ApnsConfig | OneSignalConfig;
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

export interface OneSignalConfig {
  appId: string;
  restApiKey: string;
}

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

export interface ProviderHealthCheck {
  id: string;
  providerId: string;
  status: ProviderHealthStatus;
  responseTime?: number;
  errorMessage?: string;
  message?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, any>;
  checkedAt: Date;
}

export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate?: number;
  requestsTrend?: number;
  errorBreakdown?: Array<{
    error: string;
    type?: string;
    message?: string;
    count: number;
    percentage: number;
  }>;
  lastUsed?: Date;
  timeSeriesData: ProviderTimeSeriesPoint[];
}

export interface ProviderTimeSeriesPoint {
  timestamp: Date;
  requests: number;
  successes: number;
  failures: number;
  averageResponseTime: number;
}

export interface ProviderFailoverConfig {
  tenantId: string;
  channel: ProviderType;
  providers: ProviderPriority[];
  failoverThreshold: number;
  cooldownPeriod: number;
  healthCheckInterval: number;
}

export interface ProviderPriority {
  providerId: string;
  priority: number;
  isActive: boolean;
  weight?: number;
}

export interface CreateProviderRequest {
  name: string;
  description?: string;
  type: ProviderType;
  subtype: string;
  config: ProviderConfig;
  priority?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateProviderRequest {
  name?: string;
  description?: string;
  status?: ProviderStatus;
  config?: Partial<ProviderConfig>;
  priority?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface TestProviderRequest {
  providerId: string;
  testData: ProviderTestData;
}

export interface ProviderTestData {
  email?: {
    to: string;
    subject: string;
    body: string;
  };

  sms?: {
    to: string;
    message: string;
  };

  push?: {
    deviceToken: string;
    title: string;
    body: string;
  };

  whatsapp?: {
    to: string;
    message: string;
  };

  webhook?: {
    payload: Record<string, any>;
  };
}

export interface ProviderTestResult {
  success: boolean;
  responseTime: number;
  statusCode?: number;
  response?: any;
  errorMessage?: string;
  message?: string;
  metadata?: Record<string, any>;
  testedAt: Date;
}

export interface ProviderQueryParams {
  type?: ProviderType;
  status?: ProviderStatus;
  healthStatus?: ProviderHealthStatus;
  isDefault?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface ProviderState {
  providers: Provider[];
  failoverConfigs: ProviderFailoverConfig[];
  healthChecks: ProviderHealthCheck[];
  metrics: ProviderMetrics[];
  isLoading: boolean;
  error: string | null;
}

export interface ProviderApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ProviderCreatedEvent {
  providerId: string;
  tenantId: string;
  type: ProviderType;
  name: string;
  timestamp: Date;
}

export interface ProviderStatusChangedEvent {
  providerId: string;
  tenantId: string;
  oldStatus: ProviderStatus;
  newStatus: ProviderStatus;
  timestamp: Date;
}

export interface ProviderHealthChangedEvent {
  providerId: string;
  tenantId: string;
  oldHealth: ProviderHealthStatus;
  newHealth: ProviderHealthStatus;
  errorMessage?: string;
  timestamp: Date;
}

export interface ProviderFailoverEvent {
  tenantId: string;
  channel: ProviderType;
  failedProviderId: string;
  fallbackProviderId: string;
  reason: string;
  timestamp: Date;
}
