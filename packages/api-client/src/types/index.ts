// Core types for the Notifi platform

import { TenantMember } from './tenant';

// Authentication types
export type {
  AuthError, AuthProvider, AuthResponse, User as AuthUser, ChangePasswordRequest, EmailVerificationRequest, LoginCredentials as LoginRequest, OAuthLoginRequest, PasswordResetConfirm, PasswordResetRequest, RefreshTokenRequest, RegisterData as RegisterRequest, TokenResponse, UserRole, UserStatus
} from './auth';

// Tenant types
export type { AcceptInviteRequest, CreateTenantRequest, Invitation, InviteMemberRequest, InviteStatus, TenantBillingInfo, TenantMember, TenantMemberRole, TenantQueryParams, TenantSettings as TenantSettingsType, TenantStatus, Tenant as TenantType, UpdateTenantMemberRequest as UpdateMemberRequest, UpdateTenantRequest } from './tenant';

// Permission types - create basic types if permissions module doesn't exist
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

// Notification types
export type {
  CreateNotificationRequest, InAppNotification, Notification, NotificationChannel, ChannelMetrics as NotificationChannelMetrics, NotificationMetrics, NotificationPriority, NotificationQueryParams, NotificationQueue,
  QueueStatus as NotificationQueueStatus, NotificationResponse,
  NotificationStatus, NotificationStatusUpdate, NotificationSubscription, TimeSeriesPoint as NotificationTimeSeriesPoint, NotificationType, CreateNotificationRequest as UpdateNotificationRequest
} from './notification';

// Legacy compatibility types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  tenantMemberships: TenantMember[];
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  language: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  branding: BrandingConfig;
  subscription: SubscriptionPlan;
  settings: TenantSettings;
  members: TenantMember[];
}

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
    muted?: string;
    mutedForeground?: string;
    border?: string;
    destructive?: string;
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
  };
  customCss?: string;
  isActive?: boolean;
}

export type TenantRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type Permission = "read" | "write" | "delete" | "admin";
export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type CommunicationChannel = "email" | "sms" | "push" | "in_app" | "voice" | "whatsapp";

export interface TenantSettings {
  allowMemberInvites: boolean;
  requireEmailVerification: boolean;
  maxMembers: number;
}

// Stub types for missing modules
export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
}

export interface CampaignQueryParams {
  status?: string;
  page?: number;
  limit?: number;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Template {
  id: string;
  name: string;
  content: string;
}

export interface TemplateContent {
  subject?: string;
  body: string;
  variables?: Record<string, any>;
}

export interface TemplateQueryParams {
  category?: string;
  page?: number;
  limit?: number;
}

export type TemplateType = 'email' | 'sms' | 'push';

export interface CreateTemplateRequest {
  name: string;
  content: TemplateContent;
  type: TemplateType;
}

export interface Workflow {
  id: string;
  name: string;
  status: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
}

export interface WorkflowAction {
  id: string;
  type: string;
}

export interface WorkflowCondition {
  id: string;
  type: string;
}

export interface WorkflowQueryParams {
  status?: string;
  page?: number;
  limit?: number;
}

export interface WorkflowStep {
  id: string;
  order: number;
}

export interface WorkflowTrigger {
  id: string;
  type: string;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: Date;
}

export interface AnalyticsMetrics {
  totalEvents: number;
  uniqueUsers: number;
}

export interface AnalyticsQuery {
  startDate: Date;
  endDate: Date;
  metrics: string[];
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
}

export interface CallMetrics {
  duration: number;
  quality: number;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
}

export interface ApiKeyQueryParams {
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface ApiKeyScope {
  read: boolean;
  write: boolean;
}

export interface WebSocketConnection {
  id: string;
  status: string;
}

export interface WebSocketEvent {
  type: string;
  data: any;
}

export interface WebSocketMessage {
  id: string;
  content: string;
}