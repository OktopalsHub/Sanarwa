import {
  BulkNotificationRequest,
  BulkNotificationResponse,
  CreateInAppNotificationRequest,
  CreateNotificationRequest,
  InAppNotification,
  NotificationMetrics,
  NotificationQueryParams,
  NotificationResponse,
  NotificationStatusUpdate,
  QueueStatus
} from './types/notification';
import { ApiClient, createApiClient } from './client';

/**
 * Notification API client for handling all notification-related operations
 * Implements notification sending, status tracking, history, filtering, and retry logic
 */
class NotificationApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    // Use provided client or create a new one
    this.apiClient = apiClient || createApiClient();
  }

  // Core Notification Methods (notification module)

  /**
   * Send a single notification
   * @param data Notification data (channels, recipients, content, etc.)
   * @returns Notification response with ID and status
   */
  async sendNotification(data: CreateNotificationRequest): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>('/notifications', data);
  }

  /**
   * Send multiple notifications in bulk
   * @param data Bulk notification request with array of notifications
   * @returns Bulk notification response with success/failure details
   */
  async sendBulkNotifications(data: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    return this.apiClient.post<BulkNotificationResponse>('/notifications/bulk', data);
  }

  /**
   * Get notification status by ID
   * @param notificationId Notification ID
   * @returns Current notification status and delivery details
   */
  async getNotificationStatus(notificationId: string): Promise<NotificationStatusUpdate> {
    return this.apiClient.get<NotificationStatusUpdate>(`/notifications/${notificationId}/status`);
  }

  /**
   * Retry a failed notification
   * @param notificationId Notification ID to retry
   * @returns Updated notification response
   */
  async retryNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>(`/notifications/${notificationId}/retry`, {});
  }

  /**
   * Get notifications with filtering and pagination
   * @param params Query parameters for filtering and pagination
   * @returns Paginated list of notifications
   */
  async getNotifications(params?: NotificationQueryParams): Promise<{
    data: NotificationResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.apiClient.get('/notifications', params);
  }

  /**
   * Get a single notification by ID
   * @param notificationId Notification ID
   * @returns Notification details
   */
  async getNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.get<NotificationResponse>(`/notifications/${notificationId}`);
  }

  /**
   * Cancel a notification
   * @param notificationId Notification ID to cancel
   * @returns Updated notification response
   */
  async cancelNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>(`/notifications/${notificationId}/cancel`, {});
  }

  /**
   * Get delivery statistics
   * @param params Filter parameters for delivery stats
   * @returns Delivery statistics
   */
  async getDeliveryStats(params?: {
    channel?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<NotificationMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.status) queryParams.status = params.status;

    return this.apiClient.get<NotificationMetrics>('/notifications/delivery-stats', queryParams);
  }

  // In-App Notification Methods (notifications module)

  /**
   * Create an in-app notification
   * @param data In-app notification data
   * @returns Created in-app notification
   */
  async createInAppNotification(data: CreateInAppNotificationRequest): Promise<InAppNotification> {
    // Note: This uses a different endpoint path to distinguish from the notification module
    return this.apiClient.post<InAppNotification>('/notifications', data);
  }

  /**
   * Create multiple in-app notifications in bulk
   * @param data Bulk in-app notification data
   * @returns Bulk creation response
   */
  async createBulkInAppNotifications(data: {
    notifications: CreateInAppNotificationRequest[];
  }): Promise<{
    successful: InAppNotification[];
    failed: Array<{
      notification: CreateInAppNotificationRequest;
      error: string;
    }>;
  }> {
    return this.apiClient.post('/notifications/bulk', data);
  }

  /**
   * Get in-app notifications for current user
   * @param params Query parameters for filtering
   * @returns Paginated list of in-app notifications
   */
  async getInAppNotifications(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    category?: string;
    unreadOnly?: boolean;
  }): Promise<{
    data: InAppNotification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.apiClient.get('/notifications', params);
  }

  /**
   * Mark an in-app notification as read
   * @param notificationId Notification ID to mark as read
   * @returns Updated notification
   */
  async markNotificationAsRead(notificationId: string): Promise<InAppNotification> {
    return this.apiClient.patch<InAppNotification>(`/notifications/${notificationId}/read`, {});
  }

  /**
   * Mark all in-app notifications as read for current user
   * @returns Success response
   */
  async markAllNotificationsAsRead(): Promise<{ message: string; count: number }> {
    return this.apiClient.patch('/notifications/read-all', {});
  }

  /**
   * Delete an in-app notification
   * @param notificationId Notification ID to delete
   */
  async deleteInAppNotification(notificationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/notifications/${notificationId}`);
  }

  // Analytics and Statistics Methods

  /**
   * Get notification statistics for the current tenant
   * @param startDate Optional start date for statistics
   * @param endDate Optional end date for statistics
   * @returns Notification statistics and metrics
   */
  async getNotificationStats(startDate?: Date, endDate?: Date): Promise<NotificationMetrics> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    return this.apiClient.get<NotificationMetrics>('/notifications/stats', params);
  }

  /**
   * Get delivery metrics for notifications
   * @param params Filter parameters for metrics
   * @returns Delivery metrics and analytics
   */
  async getDeliveryMetrics(params?: {
    channel?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<NotificationMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get<NotificationMetrics>('/notifications/metrics/delivery', queryParams);
  }

  /**
   * Get engagement metrics for notifications (opens, clicks, etc.)
   * @param params Filter parameters for engagement metrics
   * @returns Engagement metrics and analytics
   */
  async getEngagementMetrics(params?: {
    channel?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<{
    opens: number;
    clicks: number;
    unsubscribes: number;
    bounces: number;
    openRate: number;
    clickRate: number;
    unsubscribeRate: number;
    bounceRate: number;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get('/notifications/metrics/engagement', queryParams);
  }

  // Queue Management Methods

  /**
   * Get notification queue status
   * @returns Current queue status for all channels
   */
  async getQueueStatus(): Promise<QueueStatus[]> {
    return this.apiClient.get<QueueStatus[]>('/notifications/queue/status');
  }

  /**
   * Get queue statistics
   * @returns Detailed queue statistics
   */
  async getQueueStats(): Promise<{
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalDelayed: number;
    queues: QueueStatus[];
  }> {
    return this.apiClient.get('/notifications/queue/stats');
  }

  /**
   * Pause notification processing for a specific channel
   * @param channel Channel to pause
   */
  async pauseQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/pause`, {});
  }

  /**
   * Resume notification processing for a specific channel
   * @param channel Channel to resume
   */
  async resumeQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/resume`, {});
  }

  /**
   * Clear failed jobs from a specific channel queue
   * @param channel Channel to clear failed jobs from
   * @returns Number of jobs cleared
   */
  async clearFailedJobs(channel: string): Promise<{ cleared: number }> {
    return this.apiClient.post(`/notifications/queue/${channel}/clear-failed`, {});
  }

  // Additional methods needed by slices and queries
  async getNotificationDeliveries(notificationId: string): Promise<any[]> {
    return this.apiClient.get<any[]>(`/notifications/${notificationId}/deliveries`);
  }

  async getNotificationMetrics(filters: any): Promise<any> {
    return this.apiClient.get<any>('/notifications/metrics', filters);
  }

  async getUserSubscriptions(): Promise<any[]> {
    return this.apiClient.get<any[]>('/notifications/subscriptions');
  }

  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    return this.apiClient.patch<any>(`/notifications/subscriptions/${subscriptionId}`, updates);
  }

  async markAsRead(notificationId: string): Promise<void> {
    return this.apiClient.patch<void>(`/notifications/${notificationId}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    return this.apiClient.patch<void>('/notifications/read-all', {});
  }

  async bulkDeleteNotifications(notificationIds: string[]): Promise<void> {
    return this.apiClient.post<void>('/notifications/bulk-delete', { notificationIds });
  }

  // Utility Methods

  /**
   * Validate notification data before sending
   * @param data Notification data to validate
   * @returns Validation result with errors if any
   */
  validateNotificationData(data: CreateNotificationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate channels
    if (!data.channels || data.channels.length === 0) {
      errors.push('At least one notification channel is required');
    }

    // Validate recipients
    if (!data.recipients || data.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      data.recipients.forEach((recipient, index) => {
        if (!recipient.id) {
          errors.push(`Recipient ${index + 1}: ID is required`);
        }

        // Validate channel-specific recipient data
        data.channels.forEach(channel => {
          switch (channel) {
            case 'email':
              if (!recipient.email) {
                errors.push(`Recipient ${index + 1}: Email is required for email channel`);
              }
              break;
            case 'sms':
              if (!recipient.phone) {
                errors.push(`Recipient ${index + 1}: Phone number is required for SMS channel`);
              }
              break;
            case 'push':
              if (!recipient.deviceToken) {
                errors.push(`Recipient ${index + 1}: Device token is required for push notifications`);
              }
              break;
            case 'whatsapp':
              if (!recipient.whatsappNumber) {
                errors.push(`Recipient ${index + 1}: WhatsApp number is required for WhatsApp channel`);
              }
              break;
          }
        });
      });
    }

    // Validate content
    if (!data.templateId && !data.content) {
      errors.push('Either templateId or content is required');
    }

    // Validate scheduled date
    if (data.scheduledAt && data.scheduledAt < new Date()) {
      errors.push('Scheduled date cannot be in the past');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate in-app notification data before creating
   * @param data In-app notification data to validate
   * @returns Validation result with errors if any
   */
  validateInAppNotificationData(data: CreateInAppNotificationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.message || data.message.trim().length === 0) {
      errors.push('Message is required');
    }

    if (data.title && data.title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }

    if (data.message && data.message.length > 1000) {
      errors.push('Message must be less than 1000 characters');
    }

    if (data.scheduledAt && data.scheduledAt < new Date()) {
      errors.push('Scheduled date cannot be in the past');
    }

    if (data.expiresAt && data.expiresAt < new Date()) {
      errors.push('Expiration date cannot be in the past');
    }

    if (data.scheduledAt && data.expiresAt && data.scheduledAt >= data.expiresAt) {
      errors.push('Expiration date must be after scheduled date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a notification can be retried
   * @param status Current notification status
   * @param retryCount Current retry count
   * @param maxRetries Maximum allowed retries
   * @returns True if notification can be retried
   */
  canRetryNotification(status: string, retryCount: number, maxRetries: number = 3): boolean {
    return status === 'failed' && retryCount < maxRetries;
  }

  /**
   * Calculate retry delay using exponential backoff
   * @param retryCount Current retry count
   * @param baseDelay Base delay in milliseconds
   * @returns Delay in milliseconds
   */
  calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
  }

  /**
   * Format notification for display
   * @param notification Notification to format
   * @returns Formatted notification data
   */
  formatNotificationForDisplay(notification: InAppNotification): {
    title: string;
    message: string;
    timeAgo: string;
    isRead: boolean;
    priority: string;
    type: string;
  } {
    const now = new Date();
    const createdAt = new Date(notification.createdAt);
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo: string;
    if (diffMins < 1) {
      timeAgo = 'Just now';
    } else if (diffMins < 60) {
      timeAgo = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours}h ago`;
    } else {
      timeAgo = `${diffDays}d ago`;
    }

    return {
      title: notification.title,
      message: notification.message,
      timeAgo,
      isRead: !!notification.readAt,
      priority: notification.priority || 'normal',
      type: notification.type || 'info',
    };
  }
}

export { NotificationApiClient };
export const notificationApi = new NotificationApiClient();