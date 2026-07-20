// Analytics and metrics types

import { NotificationChannel, NotificationStatus } from './notification';
import { ProviderType } from './provider';

// Enums for analytics
export enum MetricType {
  DELIVERY = 'delivery',
  ENGAGEMENT = 'engagement',
  PERFORMANCE = 'performance',
  USAGE = 'usage',
  ERROR = 'error',
}

export enum TimeRange {
  LAST_HOUR = 'last_hour',
  LAST_24_HOURS = 'last_24_hours',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  CUSTOM = 'custom',
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  COUNT = 'count',
  RATE = 'rate',
  PERCENTAGE = 'percentage',
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

// Core analytics interfaces
export interface DeliveryMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryTime: number; // in milliseconds
  channelBreakdown: ChannelMetrics[];
  providerBreakdown: ProviderMetrics[];
  timeSeriesData: TimeSeriesPoint[];
  statusBreakdown: StatusMetrics[];
}

export interface EngagementStats {
  totalOpens: number;
  totalClicks: number;
  totalUnsubscribes: number;
  totalBounces: number;
  totalComplaints: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  complaintRate: number;
  clickThroughRate: number;
  engagementScore: number;
  timeSeriesData: EngagementTimeSeriesPoint[];
  channelEngagement: ChannelEngagementMetrics[];
}

export interface ChannelMetrics {
  channel: NotificationChannel;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryTime: number;
  cost?: number;
  costPerDelivery?: number;
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  failureRate: number;
  averageResponseTime: number;
  uptime: number;
  cost?: number;
}

export interface StatusMetrics {
  status: NotificationStatus;
  count: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  averageDeliveryTime: number;
}

export interface EngagementTimeSeriesPoint {
  timestamp: Date;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  complaints: number;
  openRate: number;
  clickRate: number;
}

export interface ChannelEngagementMetrics {
  channel: NotificationChannel;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  bounceRate: number;
}

// Usage and performance metrics
export interface UsageMetrics {
  totalNotifications: number;
  totalUsers: number;
  totalTemplates: number;
  totalProviders: number;
  apiCalls: number;
  storageUsed: number; // in bytes
  bandwidthUsed: number; // in bytes
  quotaUsage: QuotaUsageMetrics;
  costMetrics: CostMetrics;
  timeSeriesData: UsageTimeSeriesPoint[];
}

export interface QuotaUsageMetrics {
  notifications: {
    used: number;
    limit: number;
    percentage: number;
  };
  channels: Record<NotificationChannel, {
    used: number;
    limit: number;
    percentage: number;
  }>;
  apiCalls: {
    used: number;
    limit: number;
    percentage: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface CostMetrics {
  totalCost: number;
  costByChannel: Record<NotificationChannel, number>;
  costByProvider: Record<string, number>;
  costPerNotification: number;
  costTrend: CostTimeSeriesPoint[];
}

export interface CostTimeSeriesPoint {
  timestamp: Date;
  cost: number;
  notifications: number;
  costPerNotification: number;
}

export interface UsageTimeSeriesPoint {
  timestamp: Date;
  notifications: number;
  apiCalls: number;
  storageUsed: number;
  bandwidthUsed: number;
  cost: number;
}

export interface PerformanceMetrics {
  averageProcessingTime: number;
  averageQueueTime: number;
  throughput: number; // notifications per second
  errorRate: number;
  systemLoad: number;
  memoryUsage: number;
  cpuUsage: number;
  queueMetrics: QueueMetrics[];
  systemHealth: SystemHealthMetrics;
}

export interface QueueMetrics {
  queueName: string;
  size: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  throughput: number;
}

export interface SystemHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastHealthCheck: Date;
  services: ServiceHealthMetrics[];
}

export interface ServiceHealthMetrics {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
}

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
  DELIVERY = 'delivery',
  ENGAGEMENT = 'engagement',
  USAGE = 'usage',
  PERFORMANCE = 'performance',
  COST = 'cost',
  CUSTOM = 'custom',
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
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
  METRIC_CARD = 'metric_card',
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  GAUGE = 'gauge',
  FUNNEL = 'funnel',
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
  type: 'notification_sent' | 'notification_delivered' | 'notification_failed' | 'provider_error';
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
  widgets: Omit<DashboardWidget, 'id'>[];
  layout: DashboardLayout;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateDashboardRequest extends Partial<CreateDashboardRequest> {
  id: string;
}

// Query parameters
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
  severity: 'warning' | 'critical';
  timestamp: Date;
}