export enum NotificationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
  READ = "read",
}

export enum NotificationType {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
  SYSTEM = "system",
  USER_ACTION = "user_action",
  MARKETING = "marketing",
}

/** The workspace channel vocabulary — a single source of truth (@sanarwa/shared-types). */
export { NotificationChannel } from "@sanarwa/shared-types";
import { NotificationChannel } from "@sanarwa/shared-types";

/** The campaign/UI channel set — deliverable and billable, excludes webhook and chat. Keeps raw-string assignability. */
export type CommunicationChannel = `${Exclude<
  NotificationChannel,
  NotificationChannel.WEBHOOK | NotificationChannel.CHAT
>}`;

export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export enum Priority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export interface Recipient {
  id: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  whatsappNumber?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  action?: string;
  style?: "primary" | "secondary" | "danger";
}

export interface Notification {
  id: string;
  tenantId: string;
  templateId?: string;
  channels: NotificationChannel[];
  recipients: Recipient[];
  variables: Record<string, any>;
  status: NotificationStatus;
  priority: Priority;
  scheduledAt?: Date;
  subject?: string;
  data?: string;
  metadata?: Record<string, any>;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;

  deliveries?: NotificationDelivery[];
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  variables: Record<string, any>;
  metadata?: Record<string, any>;
  templateId?: string;
  category?: string;
  actionUrl?: string;
  actions?: NotificationAction[];
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  userId?: string;
  tenantId: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;

  user?: any;
  tenant?: any;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  providerId?: string;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;

  notification?: Notification;
}

export interface NotificationSubscription {
  id: string;
  userId: string;
  tenantId: string;
  channel: NotificationChannel;
  category?: string;
  isEnabled: boolean;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueue {
  id: string;
  tenantId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  scheduledAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationRequest {
  templateId?: string;
  channels: NotificationChannel[];
  recipients: Recipient[];
  variables: Record<string, any>;
  priority?: Priority;
  scheduledAt?: Date;
  subject?: string;
  data?: string;
  metadata?: Record<string, any>;
}

export interface CreateInAppNotificationRequest {
  title: string;
  message: string;
  type?: NotificationType;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  variables: Record<string, any>;
  metadata?: Record<string, any>;
  templateId?: string;
  category?: string;
  actionUrl?: string;
  actions?: NotificationAction[];
  scheduledAt?: Date;
  expiresAt?: Date;
  userId?: string;
}

export interface BulkNotificationRequest {
  notifications: CreateNotificationRequest[];
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface NotificationQueryParams {
  status?: NotificationStatus;
  type?: NotificationType;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  userId?: string;
  templateId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface NotificationResponse {
  id: string;
  tenantId: string;
  status: NotificationStatus;
  channels: NotificationChannel[];
  recipients: Recipient[];
  scheduledAt?: Date;
  createdAt: Date;
}

export interface BulkNotificationResponse {
  successful: NotificationResponse[];
  failed: Array<{
    notification: CreateNotificationRequest;
    error: string;
  }>;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
}

export interface NotificationStatusUpdate {
  id: string;
  status: NotificationStatus;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalRead?: number;
  deliveryRate: number;
  readRate?: number;
  failureRate: number;
  channelBreakdown: ChannelMetrics[];
  timeSeriesData: TimeSeriesPoint[];
}

export interface ChannelMetrics {
  channel: NotificationChannel;
  sent: number;
  delivered: number;
  failed: number;
  read?: number;
  deliveryRate: number;
  readRate?: number;
  failureRate: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  sent: number;
  delivered: number;
  failed: number;
  read?: number;
}

export interface NotificationJobData {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  priority: NotificationPriority;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface NotificationState {
  notifications: Notification[];
  inAppNotifications: InAppNotification[];
  subscriptions: NotificationSubscription[];
  queueStatus: QueueStatus[];
  metrics?: NotificationMetrics;
  isLoading: boolean;
  error: string | null;
}

export interface NotificationApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
  pagination?: PaginationInfo;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface NotificationCreatedEvent {
  notificationId: string;
  tenantId: string;
  channels: NotificationChannel[];
  recipientCount: number;
  timestamp: Date;
}

export interface NotificationSentEvent {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  timestamp: Date;
}

export interface NotificationDeliveredEvent {
  notificationId: string;
  deliveryId: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  timestamp: Date;
}

export interface NotificationFailedEvent {
  notificationId: string;
  deliveryId?: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  errorMessage: string;
  timestamp: Date;
}

export interface NotificationReadEvent {
  notificationId: string;
  tenantId: string;
  userId: string;
  timestamp: Date;
}
