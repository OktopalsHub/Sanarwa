import { NotificationChannel, NotificationStatus } from "../notification";
import { ProviderType } from "../provider";
import { MetricType } from "./enums";

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
  channels: Record<
    NotificationChannel,
    {
      used: number;
      limit: number;
      percentage: number;
    }
  >;
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

export interface ServiceHealthMetrics {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
}

export interface SystemHealthMetrics {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  lastHealthCheck: Date;
  services: ServiceHealthMetrics[];
}
