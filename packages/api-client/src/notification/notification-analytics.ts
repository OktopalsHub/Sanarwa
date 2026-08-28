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
import { NotificationInAppClient } from "./notification-inapp";

export class NotificationAnalyticsClient extends NotificationInAppClient {
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

    return this.apiClient.get<NotificationMetrics>("/notifications/stats", params);
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
    groupBy?: "hour" | "day" | "week" | "month";
  }): Promise<NotificationMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get<NotificationMetrics>("/notifications/metrics/delivery", queryParams);
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

}
