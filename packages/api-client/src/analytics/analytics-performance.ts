import { PerformanceMetrics, RealTimeMetrics } from "../types/analytics";
import { NotificationChannel } from "../types/notification";
import { AnalyticsAuditClient } from "./analytics-audit";

export class AnalyticsPerformanceClient extends AnalyticsAuditClient {
  // Performance Metrics Methods

  /**
   * Get system performance metrics
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns System performance metrics
   */
  async getSystemPerformanceMetrics(startDate?: Date, endDate?: Date): Promise<PerformanceMetrics> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get<PerformanceMetrics>("/analytics/performance/system", queryParams);
  }

  /**
   * Get provider performance metrics
   * @param params Query parameters for provider performance
   * @returns Provider performance metrics
   */
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

  /**
   * Get tenant performance metrics
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Tenant performance metrics
   */
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

  /**
   * Get performance trends
   * @param metricName Name of the metric to track
   * @param startDate Start date for trends
   * @param endDate End date for trends
   * @param interval Time interval for data points
   * @returns Performance trends data
   */
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

  /**
   * Get real-time performance metrics
   * @returns Real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    return this.apiClient.get<RealTimeMetrics>("/analytics/performance/realtime");
  }
}
