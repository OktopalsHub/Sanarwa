import { ProviderHealthStatus, ProviderType } from "./enums";

// Provider health and monitoring
export interface ProviderHealthCheck {
  id: string;
  providerId: string;
  status: ProviderHealthStatus;
  responseTime?: number;
  errorMessage?: string;
  message?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, any>;
  checkedAt: Date;
}

export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate?: number;
  requestsTrend?: number;
  errorBreakdown?: Array<{
    error: string;
    type?: string;
    message?: string;
    count: number;
    percentage: number;
  }>;
  lastUsed?: Date;
  timeSeriesData: ProviderTimeSeriesPoint[];
}

export interface ProviderTimeSeriesPoint {
  timestamp: Date;
  requests: number;
  successes: number;
  failures: number;
  averageResponseTime: number;
}

// Provider failover and priority
export interface ProviderFailoverConfig {
  tenantId: string;
  channel: ProviderType;
  providers: ProviderPriority[];
  failoverThreshold: number; // Failure rate threshold to trigger failover
  cooldownPeriod: number; // Minutes before retrying failed provider
  healthCheckInterval: number; // Minutes between health checks
}

export interface ProviderPriority {
  providerId: string;
  priority: number;
  isActive: boolean;
  weight?: number; // For load balancing
}
