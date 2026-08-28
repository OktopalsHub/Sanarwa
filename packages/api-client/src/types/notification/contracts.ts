import { NotificationChannel, NotificationPriority, NotificationStatus, NotificationType, Priority } from "./enums";
import { NotificationAction, Recipient } from "./models";

// Request/Response DTOs
export interface CreateNotificationRequest {
  templateId?: string;
  channels: NotificationChannel[];
  recipients: Recipient[];
  data: Record<string, any>;
  priority?: Priority;
  scheduledAt?: Date;
  subject?: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface CreateInAppNotificationRequest {
  title: string;
  message: string;
  type?: NotificationType;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: Record<string, any>;
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

// Analytics and metrics
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

// Job and queue interfaces
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
