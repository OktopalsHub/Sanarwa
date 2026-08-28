import { Channel } from "../../providers/types";

export interface ProviderMetrics {
  providerId: string;
  channel: Channel;
  successRate: number;
  averageResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastSuccessfulRequest?: Date;
  lastFailedRequest?: Date;
  requestsPerMinute: number;
  errorRate: number;
}

export interface PerformanceAnalytics {
  providerId: string;
  channel: Channel;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
  };
  trends: {
    successRateTrend: number;
    responseTimeTrend: number;
    throughputTrend: number;
  };
}

export interface ProviderPerformanceRecord {
  id: string;
  providerId: string;
  channel: Channel;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export function getProviderDataKey(providerId: string, channel: Channel): string {
  return `${providerId}:${channel}`;
}

export function getProviderMetricsCacheKey(providerId: string, channel: Channel): string {
  return `metrics:${providerId}:${channel}`;
}

export function generatePerformanceRecordId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
