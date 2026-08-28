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
export class NotificationCoreClient extends ApiClientConsumer {
  // Core Notification Methods (notification module)

  /**
   * Send a single notification
   * @param data Notification data (channels, recipients, content, etc.)
   * @returns Notification response with ID and status
   */
  async sendNotification(data: CreateNotificationRequest): Promise<NotificationResponse> {
    return this.apiClient.post<NotificationResponse>("/notifications", data);
  }

  /**
   * Send multiple notifications in bulk
   * @param data Bulk notification request with array of notifications
   * @returns Bulk notification response with success/failure details
   */
  async sendBulkNotifications(data: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    return this.apiClient.post<BulkNotificationResponse>("/notifications/bulk", data);
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
    return this.apiClient.get("/notifications", params);
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

    return this.apiClient.get<NotificationMetrics>("/notifications/delivery-stats", queryParams);
  }

}
