// Enums matching backend
export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

export enum TenantMemberRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export enum TenantMemberStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING = "pending",
}

export enum InviteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

// Core interfaces matching backend entities
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

// Legacy interface for backward compatibility
export interface BrandingConfig {
  id: string;
  name: string;
  logo: {
    light: string;
    dark: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  customCss?: string;
}

// Request/Response DTOs
export interface CreateTenantRequest {
  name: string;
  description?: string;
  subdomain?: string;
  slug?: string;
  quotas?: Partial<TenantQuotas>;
  settings?: Partial<TenantSettings>;
  billingInfo?: Partial<TenantBillingInfo>;
  contactInfo?: Partial<TenantContactInfo>;
}

export interface UpdateTenantRequest {
  name?: string;
  description?: string;
  subdomain?: string;
  slug?: string;
  status?: TenantStatus;
  quotas?: Partial<TenantQuotas>;
  settings?: Partial<TenantSettings>;
  billingInfo?: Partial<TenantBillingInfo>;
  contactInfo?: Partial<TenantContactInfo>;
}

export interface CreateTenantMemberRequest {
  role?: TenantMemberRole;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTenantMemberRequest {
  role?: TenantMemberRole;
  status?: TenantMemberStatus;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface InviteMemberRequest {
  email: string;
  role: TenantMemberRole;
  permissions?: string[];
  message?: string;
  metadata?: Record<string, any>;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface TenantQueryParams {
  status?: TenantStatus;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

// Legacy types for backward compatibility
export type TenantRole = TenantMemberRole;
export type Permission = string;
export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type InvitationStatus = InviteStatus;
export interface TenantInvitation extends Invitation {}

// State management
export interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  memberships: TenantMember[];
  invitations: Invitation[];
  isLoading: boolean;
  error: string | null;
}

// API response wrappers
export interface TenantApiResponse<T = any> {
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

// Events
export interface TenantCreatedEvent {
  tenantId: string;
  tenantName: string;
  userId: string;
  timestamp: Date;
}

export interface TenantMemberCreatedEvent {
  tenantId: string;
  memberId: string;
  userId: string;
  role: TenantMemberRole;
  timestamp: Date;
}

export interface InviteCreatedEvent {
  inviteId: string;
  tenantId: string;
  email: string;
  role: TenantMemberRole;
  invitedBy: string;
  timestamp: Date;
}

export interface InviteAcceptedEvent {
  inviteId: string;
  tenantId: string;
  userId: string;
  timestamp: Date;
}

export interface InviteDeclinedEvent {
  inviteId: string;
  tenantId: string;
  timestamp: Date;
}
