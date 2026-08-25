export interface TenantQuotas {
  notifications?: {
    total?: number; // -1 for unlimited
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
      total?: number; // in minutes
    };
  };
  templates?: {
    // No limits on templates
  };
  providers?: {
    total?: number; // Total number of providers allowed
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
    events?: number; // For BYOP event billing
    eventsBilling?: number; // Cost of BYOP events
    tokensBilling?: number; // Cost of token usage
    // Token balances
    emailTokens?: number;
    smsTokens?: number;
    pushTokens?: number;
    whatsappTokens?: number;
    voiceTokens?: number;
    inAppTokens?: number;
  };
  lastUpdated?: Date;
}

export interface TenantBillingInfo {
  plan?: string;
  billingEmail?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  paymentMethod?: string;
  subscription?: {
    id: string;
    plan: string;
    status: "active" | "canceled" | "past_due" | "unpaid";
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeSubscriptionId?: string;
  };
}
