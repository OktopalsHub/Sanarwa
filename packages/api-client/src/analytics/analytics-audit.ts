import { ExportFormat } from "../types/analytics";
import { AnalyticsDeliveryClient } from "./analytics-delivery";

export class AnalyticsAuditClient extends AnalyticsDeliveryClient {
  // Webhook Management Methods

  /**
   * Register webhook configuration for analytics
   * @param config Webhook configuration
   * @returns Registration result
   */
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

  /**
   * Remove webhook configuration
   */
  async removeWebhook(): Promise<void> {
    return this.apiClient.delete("/analytics/webhooks/current");
  }

  /**
   * Test webhook configuration
   * @returns Test result
   */
  async testWebhook(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.apiClient.post("/analytics/webhooks/current/test", {});
  }

  /**
   * Get webhook configuration
   * @returns Webhook configuration (without sensitive data)
   */
  async getWebhookConfig(): Promise<{
    configured: boolean;
    url?: string;
    retryAttempts?: number;
    timeout?: number;
  }> {
    return this.apiClient.get("/analytics/webhooks/current");
  }

  // Audit Log Methods

  /**
   * Get audit logs
   * @param params Query parameters for audit logs
   * @returns Audit logs
   */
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

  /**
   * Get audit trail for a specific notification
   * @param notificationId Notification ID
   * @returns Audit trail
   */
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

  /**
   * Get audit statistics
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Audit statistics
   */
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

  /**
   * Export audit logs
   * @param params Export parameters
   * @returns Export data
   */
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
}
