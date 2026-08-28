import { NotificationChannel, NotificationStatus } from "../notification";
import { AggregationType, ExportFormat, MetricType, TimeRange } from "./enums";
import { ChannelMetrics, DeliveryMetrics, EngagementStats, PerformanceMetrics, ProviderMetrics, StatusMetrics, UsageMetrics } from "./metrics";

// Reporting and export interfaces
export interface AnalyticsReport {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  filters: AnalyticsFilters;
  metrics: string[];
  schedule?: ReportSchedule;
  format: ExportFormat;
  recipients: string[];
  isActive: boolean;
  lastGenerated?: Date;
  nextGeneration?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
}

export enum ReportType {
  DELIVERY = "delivery",
  ENGAGEMENT = "engagement",
  USAGE = "usage",
  PERFORMANCE = "performance",
  COST = "cost",
  CUSTOM = "custom",
}

export interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timezone: string;
}

export interface AnalyticsFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  channels?: NotificationChannel[];
  providers?: string[];
  templates?: string[];
  users?: string[];
  status?: NotificationStatus[];
  tags?: string[];
  customFilters?: Record<string, any>;
}

export interface ExportResult {
  id: string;
  reportId?: string;
  format: ExportFormat;
  filename: string;
  url: string;
  size: number;
  expiresAt: Date;
  createdAt: Date;
}

// Dashboard and visualization
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: WidgetConfig;
  filters?: AnalyticsFilters;
  refreshInterval?: number; // in seconds
  isVisible: boolean;
}

export enum WidgetType {
  METRIC_CARD = "metric_card",
  LINE_CHART = "line_chart",
  BAR_CHART = "bar_chart",
  PIE_CHART = "pie_chart",
  TABLE = "table",
  HEATMAP = "heatmap",
  GAUGE = "gauge",
  FUNNEL = "funnel",
}

export interface WidgetConfig {
  metric: string;
  aggregation: AggregationType;
  groupBy?: string;
  limit?: number;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  customOptions?: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
}

// Real-time analytics
export interface RealTimeMetrics {
  timestamp: Date;
  activeConnections: number;
  currentThroughput: number;
  queueSizes: Record<string, number>;
  errorRate: number;
  systemLoad: number;
  recentEvents: RecentEvent[];
}

export interface RecentEvent {
  id: string;
  type: "notification_sent" | "notification_delivered" | "notification_failed" | "provider_error";
  timestamp: Date;
  data: Record<string, any>;
}

// Request/Response DTOs
export interface MetricsRequest {
  type: MetricType;
  filters: AnalyticsFilters;
  groupBy?: string[];
  aggregation?: AggregationType;
  timeRange?: TimeRange;
  customRange?: {
    start: Date;
    end: Date;
  };
}

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  filters: AnalyticsFilters;
  metrics: string[];
  schedule?: ReportSchedule;
  format: ExportFormat;
  recipients: string[];
}

export interface UpdateReportRequest extends Partial<CreateReportRequest> {
  id: string;
}

export interface ExportRequest {
  reportId?: string;
  filters: AnalyticsFilters;
  metrics: string[];
  format: ExportFormat;
  filename?: string;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  widgets: Omit<DashboardWidget, "id">[];
  layout: DashboardLayout;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateDashboardRequest extends Partial<CreateDashboardRequest> {
  id: string;
}

