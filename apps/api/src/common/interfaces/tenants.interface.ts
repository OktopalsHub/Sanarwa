export interface TenantQuotas {
  notifications?: {
    total?: number;
  };
  channels?: {
    email?: {
      total?: number;
    };
    sms?: {
      total?: number;
    };
    push?: {
      total?: number;
    };
    whatsapp?: {
      total?: number;
    };
    inApp?: {
      total?: number;
    };
    voice?: {
      total?: number;
    };
  };
  templates?: {};
  providers?: {
    total?: number;
  };
}

export interface TenantSettings {
  timezone?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  retryPolicy?: {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
  };
  rateLimiting?: {
    enabled?: boolean;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };
  notifications?: {
    enableDeliveryTracking?: boolean;
    enableOpenTracking?: boolean;
    enableClickTracking?: boolean;
    enableUnsubscribeTracking?: boolean;
  };
}

export interface TenantUsage {
  currentMonth?: {
    notifications?: number;
    email?: number;
    sms?: number;
    push?: number;
    whatsapp?: number;
    inApp?: number;
    events?: number;
    eventsBilling?: number;
    tokensBilling?: number;
    emailTokens?: number;
    smsTokens?: number;
    pushTokens?: number;
    whatsappTokens?: number;
    voiceTokens?: number;
    inAppTokens?: number;
  };
  lastUpdated?: Date;
}
