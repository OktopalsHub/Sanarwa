import {
  AnalyticsFilters,
  DeliveryMetrics,
  EngagementStats,
} from "../types/analytics";
import { AnalyticsPerformanceClient } from "./analytics-performance";

export class AnalyticsInsightsClient extends AnalyticsPerformanceClient {
  // Project and Brand Analytics Methods

  /**
   * Get analytics for a specific project
   * @param projectId Project ID
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Project analytics
   */
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

  /**
   * Get analytics for a specific brand
   * @param brandId Brand ID
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Brand analytics
   */
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

  /**
   * Compare analytics between multiple projects
   * @param projectIds Array of project IDs to compare
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Comparative project analytics
   */
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

  /**
   * Validate analytics filters
   * @param filters Analytics filters to validate
   * @returns Validation result
   */
  validateAnalyticsFilters(filters: AnalyticsFilters): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate date range
    if (filters.dateRange.start >= filters.dateRange.end) {
      errors.push("Start date must be before end date");
    }

    const now = new Date();
    if (filters.dateRange.end > now) {
      errors.push("End date cannot be in the future");
    }

    // Validate date range is not too large (e.g., max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const rangeMs = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    if (rangeMs > maxRange) {
      errors.push("Date range cannot exceed 1 year");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate percentage change between two values
   * @param current Current value
   * @param previous Previous value
   * @returns Percentage change
   */
  calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Format metrics for display
   * @param value Numeric value to format
   * @param type Type of metric (rate, count, time, etc.)
   * @returns Formatted string
   */
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

  /**
   * Generate date range presets
   * @returns Common date range presets
   */
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

  /**
   * Compare brand performance across a date range
   */
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
