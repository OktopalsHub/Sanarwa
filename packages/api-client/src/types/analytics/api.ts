import { NotificationChannel } from "../notification";
import { AggregationType, ExportFormat, MetricType, TimeRange } from "./enums";
import { DeliveryMetrics, EngagementStats, PerformanceMetrics, UsageMetrics } from "./metrics";
import { AnalyticsFilters, AnalyticsReport, Dashboard, ExportResult, RealTimeMetrics } from "./reports";

export interface AnalyticsQueryParams {
  type?: MetricType;
  timeRange?: TimeRange;
  startDate?: Date;
  endDate?: Date;
  channels?: NotificationChannel[];
  providers?: string[];
  groupBy?: string;
  aggregation?: AggregationType;
  page?: number;
  limit?: number;
}

// State management
export interface AnalyticsState {
  deliveryMetrics?: DeliveryMetrics;
  engagementStats?: EngagementStats;
  usageMetrics?: UsageMetrics;
  performanceMetrics?: PerformanceMetrics;
  reports: AnalyticsReport[];
  dashboards: Dashboard[];
  realTimeMetrics?: RealTimeMetrics;
  isLoading: boolean;
  error: string | null;
}

// API response wrappers
export interface AnalyticsApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
  metadata?: {
    generatedAt: Date;
    processingTime: number;
    dataPoints: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Events
export interface MetricsUpdatedEvent {
  tenantId: string;
  type: MetricType;
  timestamp: Date;
  data: Record<string, any>;
}

export interface ReportGeneratedEvent {
  reportId: string;
  tenantId: string;
  format: ExportFormat;
  size: number;
  timestamp: Date;
}

export interface ThresholdExceededEvent {
  tenantId: string;
  metric: string;
  threshold: number;
  currentValue: number;
  severity: "warning" | "critical";
  timestamp: Date;
}
