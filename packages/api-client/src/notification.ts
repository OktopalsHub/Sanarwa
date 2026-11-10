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
  QueueStatus,
} from "./types/notification";
import { ApiClient, apiClient as sharedApiClient } from "./client";

class NotificationApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async sendNotification(data: CreateNotificationRequest): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>("/notifications", data);
  }

  async sendBulkNotifications(data: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    return this.apiClient.post<BulkNotificationResponse>("/notifications/bulk", data);
  }

  async getNotificationStatus(notificationId: string): Promise<NotificationStatusUpdate> {
    return this.apiClient.get<NotificationStatusUpdate>(`/notifications/${notificationId}/status`);
  }

  async retryNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>(`/notifications/${notificationId}/retry`, {});
  }

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
    return this.apiClient.get("/notifications", params);
  }

  async getNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.get<NotificationResponse>(`/notifications/${notificationId}`);
  }

  async cancelNotification(notificationId: string): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>(`/notifications/${notificationId}/cancel`, {});
  }

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

    return this.apiClient.get<NotificationMetrics>("/notifications/delivery-stats", queryParams);
  }

  async createInAppNotification(data: CreateInAppNotificationRequest): Promise<InAppNotification> {
    return this.apiClient.post<InAppNotification>("/notifications", data);
  }

  async createBulkInAppNotifications(data: {
    notifications: CreateInAppNotificationRequest[];
  }): Promise<{
    successful: InAppNotification[];
    failed: Array<{
      notification: CreateInAppNotificationRequest;
      error: string;
    }>;
  }> {
    return this.apiClient.post("/notifications/bulk", data);
  }

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
    return this.apiClient.get("/notifications", params);
  }

  async markNotificationAsRead(notificationId: string): Promise<InAppNotification> {
    return this.apiClient.patch<InAppNotification>(`/notifications/${notificationId}/read`, {});
  }

  async markAllNotificationsAsRead(): Promise<{ message: string; count: number }> {
    return this.apiClient.patch("/notifications/read-all", {});
  }

  async deleteInAppNotification(notificationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/notifications/${notificationId}`);
  }

  async getNotificationStats(startDate?: Date, endDate?: Date): Promise<NotificationMetrics> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    return this.apiClient.get<NotificationMetrics>("/notifications/stats", params);
  }

  async getDeliveryMetrics(params?: {
    channel?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: "hour" | "day" | "week" | "month";
  }): Promise<NotificationMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get<NotificationMetrics>("/notifications/metrics/delivery", queryParams);
  }

  async getEngagementMetrics(params?: {
    channel?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: "hour" | "day" | "week" | "month";
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

    return this.apiClient.get("/notifications/metrics/engagement", queryParams);
  }

  async getQueueStatus(): Promise<QueueStatus[]> {
    return this.apiClient.get<QueueStatus[]>("/notifications/queue/status");
  }

  async getQueueStats(): Promise<{
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalDelayed: number;
    queues: QueueStatus[];
  }> {
    return this.apiClient.get("/notifications/queue/stats");
  }

  async pauseQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/pause`, {});
  }

  async resumeQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/resume`, {});
  }

  async clearFailedJobs(channel: string): Promise<{ cleared: number }> {
    return this.apiClient.post(`/notifications/queue/${channel}/clear-failed`, {});
  }

  async getNotificationDeliveries(notificationId: string): Promise<any[]> {
    return this.apiClient.get<any[]>(`/notifications/${notificationId}/deliveries`);
  }

  async getNotificationMetrics(filters: any): Promise<any> {
    return this.apiClient.get<any>("/notifications/metrics", filters);
  }

  async getUserSubscriptions(): Promise<any[]> {
    return this.apiClient.get<any[]>("/notifications/subscriptions");
  }

  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    return this.apiClient.patch<any>(`/notifications/subscriptions/${subscriptionId}`, updates);
  }

  async markAsRead(notificationId: string): Promise<void> {
    return this.apiClient.patch<void>(`/notifications/${notificationId}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    return this.apiClient.patch<void>("/notifications/read-all", {});
  }

  async bulkDeleteNotifications(notificationIds: string[]): Promise<void> {
    return this.apiClient.post<void>("/notifications/bulk-delete", { notificationIds });
  }

  validateNotificationData(data: CreateNotificationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.channels || data.channels.length === 0) {
      errors.push("At least one notification channel is required");
    }

    if (!data.recipients || data.recipients.length === 0) {
      errors.push("At least one recipient is required");
    } else {
      data.recipients.forEach((recipient, index) => {
        if (!recipient.id) {
          errors.push(`Recipient ${index + 1}: ID is required`);
        }

        data.channels.forEach((channel) => {
          switch (channel) {
            case "email":
              if (!recipient.email) {
                errors.push(`Recipient ${index + 1}: Email is required for email channel`);
              }
              break;
            case "sms":
              if (!recipient.phone) {
                errors.push(`Recipient ${index + 1}: Phone number is required for SMS channel`);
              }
              break;
            case "push":
              if (!recipient.deviceToken) {
                errors.push(
                  `Recipient ${index + 1}: Device token is required for push notifications`,
                );
              }
              break;
            case "whatsapp":
              if (!recipient.whatsappNumber) {
                errors.push(
                  `Recipient ${index + 1}: WhatsApp number is required for WhatsApp channel`,
                );
              }
              break;
          }
        });
      });
    }

    if (!data.templateId && !data.data) {
      errors.push("Either templateId or data is required");
    }

    if (data.scheduledAt && data.scheduledAt < new Date()) {
      errors.push("Scheduled date cannot be in the past");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateInAppNotificationData(data: CreateInAppNotificationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push("Title is required");
    }

    if (!data.message || data.message.trim().length === 0) {
      errors.push("Message is required");
    }

    if (data.title && data.title.length > 100) {
      errors.push("Title must be less than 100 characters");
    }

    if (data.message && data.message.length > 1000) {
      errors.push("Message must be less than 1000 characters");
    }

    if (data.scheduledAt && data.scheduledAt < new Date()) {
      errors.push("Scheduled date cannot be in the past");
    }

    if (data.expiresAt && data.expiresAt < new Date()) {
      errors.push("Expiration date cannot be in the past");
    }

    if (data.scheduledAt && data.expiresAt && data.scheduledAt >= data.expiresAt) {
      errors.push("Expiration date must be after scheduled date");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  canRetryNotification(status: string, retryCount: number, maxRetries: number = 3): boolean {
    return status === "failed" && retryCount < maxRetries;
  }

  calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, retryCount), 30000);
  }

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
      timeAgo = "Just now";
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
      priority: notification.priority || "normal",
      type: notification.type || "info",
    };
  }
}

export { NotificationApiClient };
export const notificationApi = new NotificationApiClient();
