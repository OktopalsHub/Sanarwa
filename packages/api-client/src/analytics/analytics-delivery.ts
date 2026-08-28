import {
  DeliveryMetrics,
  EngagementStats,
  PerformanceMetrics,
  UsageMetrics,
} from "../types/analytics";
import { NotificationChannel } from "../types/notification";
import { ApiClientConsumer } from "../internal/api-client-consumer";

export class AnalyticsDeliveryClient extends ApiClientConsumer {
  // Core Analytics Methods

  /**
   * Get delivery rate analytics
   * @param params Query parameters for delivery analytics
   * @returns Delivery rate analytics data
   */
  async getDeliveryRateAnalytics(params?: {
    startDate?: Date;
    endDate?: Date;
    channel?: NotificationChannel;
    status?: string;
    priority?: string;
  }): Promise<DeliveryMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.status) queryParams.status = params.status;
    if (params?.priority) queryParams.priority = params.priority;

    return this.apiClient.get<DeliveryMetrics>("/analytics/delivery-rates", queryParams);
  }

  /**
   * Get channel analytics
   * @param params Query parameters for channel analytics
   * @returns Channel performance analytics
   */
  async getChannelAnalytics(params?: { startDate?: Date; endDate?: Date }): Promise<{
    channels: Array<{
      channel: NotificationChannel;
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
      averageDeliveryTime: number;
    }>;
    totalSent: number;
    totalDelivered: number;
    overallDeliveryRate: number;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();

    return this.apiClient.get("/analytics/channels", queryParams);
  }

  /**
   * Get provider analytics
   * @param params Query parameters for provider analytics
   * @returns Provider performance analytics
   */
  async getProviderAnalytics(params?: {
    startDate?: Date;
    endDate?: Date;
    channel?: NotificationChannel;
  }): Promise<{
    providers: Array<{
      providerId: string;
      providerName: string;
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
      averageResponseTime: number;
    }>;
    totalProviders: number;
    averageDeliveryRate: number;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.channel) queryParams.channel = params.channel;

    return this.apiClient.get("/analytics/providers", queryParams);
  }

  /**
   * Get time series analytics data
   * @param params Query parameters for time series data
   * @returns Time series analytics data
   */
  async getTimeSeriesData(params?: {
    startDate?: Date;
    endDate?: Date;
    channel?: NotificationChannel;
    interval?: "hour" | "day" | "week" | "month";
  }): Promise<{
    data: Array<{
      timestamp: Date;
      sent: number;
      delivered: number;
      failed: number;
      deliveryRate: number;
    }>;
    interval: string;
    totalDataPoints: number;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.interval) queryParams.interval = params.interval;

    return this.apiClient.get("/analytics/time-series", queryParams);
  }

  /**
   * Get comprehensive tenant analytics
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Comprehensive tenant analytics
   */
  async getTenantAnalytics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    deliveryMetrics: DeliveryMetrics;
    engagementStats: EngagementStats;
    usageMetrics: UsageMetrics;
    performanceMetrics: PerformanceMetrics;
    summary: {
      totalNotifications: number;
      deliveryRate: number;
      engagementRate: number;
      topChannel: NotificationChannel;
      topProvider: string;
    };
  }> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    // Note: The backend expects tenantId in the path, but with tenant-scoped API client,
    // we'll use a different approach or the backend needs to be updated
    return this.apiClient.get("/analytics/dashboard", queryParams);
  }

  async getDashboard(startDate?: Date, endDate?: Date) {
    return this.getTenantAnalytics(startDate, endDate);
  }

  /**
   * Get top performing providers
   * @param params Query parameters for top providers
   * @returns Top performing providers
   */
  async getTopProviders(params?: { limit?: number; startDate?: Date; endDate?: Date }): Promise<
    Array<{
      providerId: string;
      providerName: string;
      deliveryRate: number;
      totalSent: number;
      averageResponseTime: number;
      rank: number;
    }>
  > {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();

    return this.apiClient.get("/analytics/providers/top", queryParams);
  }

  /**
   * Get delivery trends comparison
   * @param currentPeriodStart Start of current period
   * @param currentPeriodEnd End of current period
   * @param previousPeriodStart Start of previous period
   * @param previousPeriodEnd End of previous period
   * @returns Delivery trends comparison
   */
  async getDeliveryTrends(
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    previousPeriodStart: Date,
    previousPeriodEnd: Date,
  ): Promise<{
    currentPeriod: DeliveryMetrics;
    previousPeriod: DeliveryMetrics;
    comparison: {
      sentChange: number;
      deliveredChange: number;
      deliveryRateChange: number;
      trend: "up" | "down" | "stable";
    };
  }> {
    return this.apiClient.get("/analytics/trends", {
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      previousPeriodStart: previousPeriodStart.toISOString(),
      previousPeriodEnd: previousPeriodEnd.toISOString(),
    });
  }

  // Delivery Tracking Methods

  /**
   * Get delivery statistics
   * @param params Query parameters for delivery stats
   * @returns Delivery statistics
   */
  async getDeliveryStats(params?: {
    channel?: NotificationChannel;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
    deliveryRateByHour: Array<{
      hour: number;
      deliveries: number;
      successRate: number;
    }>;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();

    return this.apiClient.get("/analytics/delivery-stats", queryParams);
  }

  /**
   * Get delivery history for a specific notification
   * @param notificationId Notification ID
   * @returns Delivery history
   */
  async getDeliveryHistory(notificationId: string): Promise<
    Array<{
      id: string;
      channel: NotificationChannel;
      status: string;
      timestamp: Date;
      providerId?: string;
      errorMessage?: string;
      metadata?: Record<string, any>;
    }>
  > {
    return this.apiClient.get(`/analytics/delivery-history/${notificationId}`);
  }

  /**
   * Get delivery status for multiple notifications
   * @param notificationIds Array of notification IDs
   * @returns Delivery statuses
   */
  async getMultipleDeliveryStatus(notificationIds: string[]): Promise<
    Array<{
      notificationId: string;
      status: string;
      deliveredAt?: Date;
      failedAt?: Date;
      errorMessage?: string;
    }>
  > {
    return this.apiClient.post("/analytics/delivery-status/batch", {
      notificationIds,
    });
  }
}
