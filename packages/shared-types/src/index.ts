export type Environment = "development" | "staging" | "production" | "test";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ApiErrorDetail[];
  pagination?: PaginationMeta;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
}

export interface CampaignStatus {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
}

/**
 * Single source of truth for channel vocabulary across the workspace
 * (api, web, sdk, api-client, shared). Do not re-declare it anywhere.
 */
export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WHATSAPP = "whatsapp",
  IN_APP = "in_app",
  VOICE = "voice",
  WEBHOOK = "webhook",
  CHAT = "chat",
}

/** Channels that carry a token cost. Webhook is deliverable but unbilled. */
export const BILLABLE_CHANNELS = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
  NotificationChannel.VOICE,
  NotificationChannel.CHAT,
] as const;

/** Canonical billable-channel type — derived from the single channel enum. */
export type BillingChannel = (typeof BILLABLE_CHANNELS)[number];

export function isBillableChannel(value: NotificationChannel | string): value is BillingChannel {
  return (BILLABLE_CHANNELS as readonly string[]).includes(value);
}

/** Core send fan-out — everything except webhook and chat. */
export const CoreNotificationChannels = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
  NotificationChannel.VOICE,
] as const;

/** Channels the delivery engine accepts for immediate dispatch. `voice` routes through an assisted path and is excluded. */
export const DELIVERABLE_CHANNELS_LIST = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.WEBHOOK,
  NotificationChannel.IN_APP,
  NotificationChannel.CHAT,
] as const;

export const DELIVERABLE_CHANNELS: ReadonlySet<string> = new Set<string>(DELIVERABLE_CHANNELS_LIST);

export type DeliverableSendChannel = (typeof DELIVERABLE_CHANNELS_LIST)[number];

/** Deliverable, token-billed channels (matches BILLABLE_CHANNELS minus chat). */
export type DeliverableChannel = Exclude<
  NotificationChannel,
  NotificationChannel.WEBHOOK | NotificationChannel.CHAT
>;

/** Channels with a provider integration (in_app is managed-only, webhook is transport-only). */
export type ProviderChannel = Exclude<
  NotificationChannel,
  NotificationChannel.WEBHOOK | NotificationChannel.CHAT | NotificationChannel.IN_APP
>;

export interface TemplateChannel {
  type: DeliverableChannel;
  enabled: boolean;
}

export interface ProviderType {
  type: ProviderChannel;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
}
