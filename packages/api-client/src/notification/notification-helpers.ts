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
} from "../types/notification";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { NotificationQueueClient } from "./notification-queue";

export class NotificationHelpersClient extends NotificationQueueClient {
  // Additional methods needed by slices and queries
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
      errors.push("At least one notification channel is required");
    }

    // Validate recipients
    if (!data.recipients || data.recipients.length === 0) {
      errors.push("At least one recipient is required");
    } else {
      data.recipients.forEach((recipient, index) => {
        if (!recipient.id) {
          errors.push(`Recipient ${index + 1}: ID is required`);
        }

        // Validate channel-specific recipient data
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

    // Validate content
    if (!data.templateId && !data.content) {
      errors.push("Either templateId or content is required");
    }

    // Validate scheduled date
    if (data.scheduledAt && data.scheduledAt < new Date()) {
      errors.push("Scheduled date cannot be in the past");
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

  /**
   * Check if a notification can be retried
   * @param status Current notification status
   * @param retryCount Current retry count
   * @param maxRetries Maximum allowed retries
   * @returns True if notification can be retried
   */
  canRetryNotification(status: string, retryCount: number, maxRetries: number = 3): boolean {
    return status === "failed" && retryCount < maxRetries;
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
