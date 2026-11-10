import {
  AnalyticsFilters,
  DeliveryMetrics,
  EngagementStats,
  ExportFormat,
  PerformanceMetrics,
  RealTimeMetrics,
  UsageMetrics,
} from "./types/analytics";
import { NotificationChannel } from "./types/notification";
import { ApiClient, apiClient as sharedApiClient } from "./client";

class AnalyticsApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

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

    return this.apiClient.get("/analytics/dashboard", queryParams);
  }

  async getDashboard(startDate?: Date, endDate?: Date) {
    return this.getTenantAnalytics(startDate, endDate);
  }

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

  async registerWebhook(config: {
    url: string;
    secret?: string;
    headers?: Record<string, string>;
    retryAttempts?: number;
    timeout?: number;
  }): Promise<{
    message: string;
    url: string;
  }> {
    return this.apiClient.post("/analytics/webhooks", config);
  }

  async removeWebhook(): Promise<void> {
    return this.apiClient.delete("/analytics/webhooks/current");
  }

  async testWebhook(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.apiClient.post("/analytics/webhooks/current/test", {});
  }

  async getWebhookConfig(): Promise<{
    configured: boolean;
    url?: string;
    retryAttempts?: number;
    timeout?: number;
  }> {
    return this.apiClient.get("/analytics/webhooks/current");
  }

  async getAuditLogs(params?: {
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      eventType: string;
      resourceType: string;
      resourceId: string;
      userId: string;
      timestamp: Date;
      details: Record<string, any>;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.eventType) queryParams.eventType = params.eventType;
    if (params?.resourceType) queryParams.resourceType = params.resourceType;
    if (params?.resourceId) queryParams.resourceId = params.resourceId;
    if (params?.userId) queryParams.userId = params.userId;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get("/analytics/audit-logs", queryParams);
  }

  async getNotificationAuditTrail(notificationId: string): Promise<
    Array<{
      id: string;
      eventType: string;
      timestamp: Date;
      userId: string;
      details: Record<string, any>;
    }>
  > {
    return this.apiClient.get(`/analytics/audit-logs/notification/${notificationId}`);
  }

  async getAuditStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByUser: Record<string, number>;
    eventsByResource: Record<string, number>;
    timeSeriesData: Array<{
      timestamp: Date;
      eventCount: number;
    }>;
  }> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get("/analytics/audit-logs/statistics", queryParams);
  }

  async exportAuditLogs(params: {
    format: ExportFormat;
    eventType?: string;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    format: ExportFormat;
    data: any;
    exportedAt: string;
  }> {
    const queryParams: Record<string, string> = {
      format: params.format,
    };
    if (params.eventType) queryParams.eventType = params.eventType;
    if (params.resourceType) queryParams.resourceType = params.resourceType;
    if (params.resourceId) queryParams.resourceId = params.resourceId;
    if (params.userId) queryParams.userId = params.userId;
    if (params.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get("/analytics/audit-logs/export", queryParams);
  }

  async getSystemPerformanceMetrics(startDate?: Date, endDate?: Date): Promise<PerformanceMetrics> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get<PerformanceMetrics>("/analytics/performance/system", queryParams);
  }

  async getProviderPerformanceMetrics(params?: {
    providerId?: string;
    channel?: NotificationChannel;
    startDate?: Date;
    endDate?: Date;
  }): Promise<
    Array<{
      providerId: string;
      providerName: string;
      averageResponseTime: number;
      successRate: number;
      errorRate: number;
      throughput: number;
      uptime: number;
    }>
  > {
    const queryParams: Record<string, string> = {};
    if (params?.providerId) queryParams.providerId = params.providerId;
    if (params?.channel) queryParams.channel = params.channel;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();

    return this.apiClient.get("/analytics/performance/providers", queryParams);
  }

  async getTenantPerformanceMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    averageProcessingTime: number;
    throughput: number;
    errorRate: number;
    queueMetrics: Array<{
      queueName: string;
      size: number;
      averageWaitTime: number;
      throughput: number;
    }>;
    resourceUsage: {
      cpu: number;
      memory: number;
      storage: number;
    };
  }> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get("/analytics/performance/tenant/current", queryParams);
  }

  async getPerformanceTrends(
    metricName: string,
    startDate: Date,
    endDate: Date,
    interval?: "hour" | "day",
  ): Promise<{
    metric: string;
    interval: string;
    data: Array<{
      timestamp: Date;
      value: number;
    }>;
    trend: "up" | "down" | "stable";
    changePercentage: number;
  }> {
    return this.apiClient.get("/analytics/performance/trends", {
      metricName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interval: interval || "hour",
    });
  }

  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    return this.apiClient.get<RealTimeMetrics>("/analytics/performance/realtime");
  }

  async getProjectAnalytics(
    projectId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    projectId: string;
    projectName: string;
    deliveryMetrics: DeliveryMetrics;
    engagementStats: EngagementStats;
    topTemplates: Array<{
      templateId: string;
      templateName: string;
      usageCount: number;
      deliveryRate: number;
    }>;
  }> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get(`/analytics/project/${projectId}`, queryParams);
  }

  async getBrandAnalytics(
    brandId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    brandId: string;
    brandName: string;
    deliveryMetrics: DeliveryMetrics;
    engagementStats: EngagementStats;
    brandConsistency: {
      templatesUsed: number;
      brandCompliance: number;
    };
  }> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get(`/analytics/brand/${brandId}`, queryParams);
  }

  async compareProjects(
    projectIds: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    projects: Array<{
      projectId: string;
      projectName: string;
      deliveryRate: number;
      engagementRate: number;
      totalNotifications: number;
    }>;
    comparison: {
      bestPerforming: string;
      worstPerforming: string;
      averageDeliveryRate: number;
      averageEngagementRate: number;
    };
  }> {
    const queryParams: Record<string, string> = {
      projectIds: projectIds.join(","),
    };
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get("/analytics/projects/compare", queryParams);
  }

  validateAnalyticsFilters(filters: AnalyticsFilters): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (filters.dateRange.start >= filters.dateRange.end) {
      errors.push("Start date must be before end date");
    }

    const now = new Date();
    if (filters.dateRange.end > now) {
      errors.push("End date cannot be in the future");
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000;
    const rangeMs = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    if (rangeMs > maxRange) {
      errors.push("Date range cannot exceed 1 year");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  formatMetricValue(
    value: number,
    type: "rate" | "count" | "time" | "percentage" | "bytes",
  ): string {
    switch (type) {
      case "rate":
        return `${(value * 100).toFixed(1)}%`;
      case "count":
        return value.toLocaleString();
      case "time":
        if (value < 1000) return `${value.toFixed(0)}ms`;
        if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
        return `${(value / 60000).toFixed(1)}m`;
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "bytes":
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = value;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
      default:
        return value.toString();
    }
  }

  getDateRangePresets(): Array<{
    label: string;
    value: string;
    startDate: Date;
    endDate: Date;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return [
      {
        label: "Last 24 Hours",
        value: "last_24_hours",
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endDate: now,
      },
      {
        label: "Last 7 Days",
        value: "last_7_days",
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now,
      },
      {
        label: "Last 30 Days",
        value: "last_30_days",
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now,
      },
      {
        label: "Last 90 Days",
        value: "last_90_days",
        startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now,
      },
      {
        label: "This Month",
        value: "this_month",
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now,
      },
      {
        label: "Last Month",
        value: "last_month",
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0),
      },
    ];
  }

  async compareBrands(
    brandIds: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ brandId: string; sent: number; delivered: number; engagement: number }>> {
    void startDate;
    void endDate;
    return brandIds.map((brandId) => ({
      brandId,
      sent: 0,
      delivered: 0,
      engagement: 0,
    }));
  }
}

export const analyticsApi = new AnalyticsApiClient();
