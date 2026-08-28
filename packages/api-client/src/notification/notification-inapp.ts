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
import { NotificationCoreClient } from "./notification-core";

export class NotificationInAppClient extends NotificationCoreClient {
  // In-App Notification Methods (notifications module)

  /**
   * Create an in-app notification
   * @param data In-app notification data
   * @returns Created in-app notification
   */
  async createInAppNotification(data: CreateInAppNotificationRequest): Promise<InAppNotification> {
    // Note: This uses a different endpoint path to distinguish from the notification module
    return this.apiClient.post<InAppNotification>("/notifications", data);
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
    return this.apiClient.post("/notifications/bulk", data);
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
    return this.apiClient.get("/notifications", params);
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
    return this.apiClient.patch("/notifications/read-all", {});
  }

  /**
   * Delete an in-app notification
   * @param notificationId Notification ID to delete
   */
  async deleteInAppNotification(notificationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/notifications/${notificationId}`);
  }

}
