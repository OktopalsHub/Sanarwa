// Core types based on the OpenAPI specification

export type NotificationChannel = "email" | "sms" | "push" | "whatsapp" | "in_app" | "voice";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "scheduled";

export type RecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "opened"
  | "clicked";

export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "bounced";

export interface Recipient {
  email?: string;
  phone?: string;
  name?: string;
  userId?: string;
  deviceTokens?: string[];

  metadata?: Record<string, any>;
  tenant?: string; // Optional tenant identifier for this recipient
}

export interface Attachment {
  filename: string;
  content: string; // Base64 encoded
  contentType?: string;
}

export interface NotificationContent {
  subject?: string;
  body?: string;
  html?: string;
  attachments?: Attachment[];
}

export interface NotificationRequest {
  templateId?: string;
  recipients: Recipient[];
  channels: NotificationChannel[];
  data?: Record<string, any>;
  content?: NotificationContent;
  priority?: NotificationPriority;
  scheduledAt?: string; // ISO 8601 date-time - Schedule for future delivery
  expiresAt?: string; // ISO 8601 date-time - Expire if not delivered by this time
  timezone?: string; // Timezone for scheduling (e.g., 'America/New_York')
  metadata?: Record<string, any>;
  tenant?: string; // Optional tenant identifier for multi-tenant applications
  tags?: string[]; // Tags for categorization and filtering
  trackingId?: string; // Custom tracking ID for your reference
  suppressDuplicates?: boolean; // Prevent duplicate notifications
  rateLimitKey?: string; // Key for rate limiting (e.g., user ID)
  retryPolicy?: RetryPolicy; // Custom retry configuration
  deliveryWindow?: DeliveryWindow; // Delivery time constraints
  webhookUrl?: string; // Webhook for delivery status updates
}

export interface BulkNotificationRequest {
  notifications: NotificationRequest[];
}

export interface NotificationResponse {
  id: string;
  status: NotificationStatus;
  createdAt: string;
  scheduledAt?: string;
  estimatedDelivery?: string;
  channels: string[];
  recipientCount: number;
}

export interface BulkError {
  index: number;
  error: string;
  message: string;
}

export interface BulkNotificationResponse {
  batchId: string;
  totalNotifications: number;
  acceptedNotifications: number;
  rejectedNotifications: number;
  notifications: NotificationResponse[];
  errors: BulkError[];
}

export interface RecipientStatusDetail {
  email?: string;
  phone?: string;
  name?: string;
  status: RecipientStatus;
}

export interface DeliveryStatusDetail {
  channel: string;
  provider: string;
  status: DeliveryStatus;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface NotificationDetails {
  id: string;
  status: NotificationStatus;
  templateId?: string;
  channels: string[];
  recipients: RecipientStatusDetail[];
  deliveries: DeliveryStatusDetail[];
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  metadata?: Record<string, any>;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  channel: string;
  content: Record<string, any>;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface AnalyticsSummary {
  totalNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  deliveryRate: number;
  channelBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  timeSeriesData: TimeSeriesPoint[];
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  from?: string;
  to?: string;
}

export interface ListTemplatesParams {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
}

export interface AnalyticsParams {
  from?: string;
  to?: string;
  channel?: NotificationChannel;
}

// Advanced scheduling and delivery types
export interface RetryPolicy {
  maxRetries?: number; // Maximum number of retry attempts
  retryDelay?: number; // Delay between retries in seconds
  backoffMultiplier?: number; // Exponential backoff multiplier
  maxDelay?: number; // Maximum delay between retries
}

export interface DeliveryWindow {
  startTime?: string; // Start time in HH:MM format (e.g., "09:00")
  endTime?: string; // End time in HH:MM format (e.g., "17:00")
  daysOfWeek?: number[]; // Days of week (0=Sunday, 1=Monday, etc.)
  timezone?: string; // Timezone for the delivery window
}

export interface ScheduleOptions {
  scheduledAt: string; // ISO 8601 date-time
  timezone?: string; // Timezone for scheduling
  deliveryWindow?: DeliveryWindow; // Delivery constraints
  expiresAt?: string; // Expiration time
}

export interface RecurringSchedule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number; // Every N frequency units (e.g., every 2 weeks)
  daysOfWeek?: number[]; // For weekly frequency
  dayOfMonth?: number; // For monthly frequency
  startDate: string; // ISO 8601 date
  endDate?: string; // ISO 8601 date (optional)
  maxOccurrences?: number; // Maximum number of occurrences
}

// In-App Notification Types
export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category?: string;
  actionUrl?: string;
  data?: Record<string, any>;
  status: "read" | "unread";
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

export interface InAppStats {
  totalSent: number;
  totalRead: number;
  totalUnread: number;
  readRate: number;
  categoryBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  period: {
    startDate: string;
    endDate: string;
  };
}

// Push Notification Types
export interface PushNotification {
  id: string;
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: "pending" | "sent" | "delivered" | "failed";
  platform?: "ios" | "android" | "web";
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  error?: string;
  priority: "normal" | "high";
  badge?: number;
  sound?: string;
  category?: string;
  imageUrl?: string;
  actionUrl?: string;
}

export interface PushStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  failureRate: number;
  avgDeliveryTime: number; // seconds
  topDevicePlatforms: Array<{
    platform: string;
    count: number;
    percentage: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

// Device Registration Types
export interface DeviceRegistration {
  deviceToken: string;
  platform: "ios" | "android" | "web";
  userId?: string;
  metadata?: Record<string, any>;
}
