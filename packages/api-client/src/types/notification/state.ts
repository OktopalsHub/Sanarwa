import { NotificationChannel } from "./enums";
import { InAppNotification, Notification, NotificationSubscription } from "./models";
import { ChannelMetrics, NotificationMetrics, QueueStatus, TimeSeriesPoint } from "./contracts";

// State management
export interface NotificationState {
  notifications: Notification[];
  inAppNotifications: InAppNotification[];
  subscriptions: NotificationSubscription[];
  queueStatus: QueueStatus[];
  metrics?: NotificationMetrics;
  isLoading: boolean;
  error: string | null;
}

// API response wrappers
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

// Events
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
