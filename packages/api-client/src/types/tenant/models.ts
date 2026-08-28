import { InviteStatus, TenantMemberRole, TenantMemberStatus, TenantStatus } from "./enums";
import { BrandingConfig } from "./legacy";

export type SubscriptionPlan = "free" | "pro" | "enterprise";

export interface TenantQuotas {
  notifications: {
    daily?: number;
    monthly?: number;
    total?: number;
  };
  channels: {
    email?: {
      daily?: number;
      monthly?: number;
    };
    sms?: {
      daily?: number;
      monthly?: number;
    };
    push?: {
      daily?: number;
      monthly?: number;
    };
    whatsapp?: {
      daily?: number;
      monthly?: number;
    };
    inApp?: {
      daily?: number;
      monthly?: number;
    };
  };
  templates?: {
    total?: number;
    versionsPerTemplate?: number;
  };
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
  // Legacy settings for backward compatibility
  allowMemberInvites?: boolean;
  requireEmailVerification?: boolean;
  maxMembers?: number;
  features?: TenantFeatures;
}

export interface TenantFeatures {
  campaigns: boolean;
  workflows: boolean;
  analytics: boolean;
  templates: boolean;
  branding: boolean;
  apiAccess: boolean;
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
}

export interface TenantContactInfo {
  primaryContact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  technicalContact?: {
    name?: string;
    email?: string;
    phone?: string;
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
  };
  lastUpdated?: Date;
}

export interface Tenant {
  id: string;
  name: string;
  description?: string;
  subdomain?: string;
  slug?: string; // Added for compatibility
  status: TenantStatus;
  quotas: TenantQuotas;
  settings?: TenantSettings;
  billingInfo?: TenantBillingInfo;
  contactInfo?: TenantContactInfo;
  usage?: TenantUsage;
  branding?: BrandingConfig; // Added for compatibility
  subscription?: SubscriptionPlan; // Added for compatibility
  lastActiveAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Relationships (populated when needed)
  user?: any; // Will be typed in auth.ts
  members?: TenantMember[];
  roles?: any[]; // Will be typed in permissions.ts
}

export interface TenantMember {
  id: string;
  role: TenantMemberRole;
  status: TenantMemberStatus;
  permissions?: string[];
  invitedAt?: Date;
  joinedAt?: Date;
  invitedBy?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  tenant?: Tenant;
  user?: any; // Will be typed in auth.ts
  userId?: string;
  tenantId?: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  status: InviteStatus;
  role: TenantMemberRole;
  permissions?: string[];
  expiresAt: Date;
  message?: string;
  metadata?: Record<string, any>;
  acceptedAt?: Date;
  declinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  tenant?: Tenant;
  tenantId?: string;
  invitedBy?: any; // Will be typed in auth.ts
  acceptedBy?: any; // Will be typed in auth.ts
}
