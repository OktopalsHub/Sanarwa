import { Channel, ProviderHealthStatus } from '../types';

export interface ProviderHealthMetrics {
  providerId: string;
  channel: Channel;
  healthStatus: ProviderHealthStatus;
  successRate: number;
  averageResponseTime: number;
  totalRequests: number;
  failedRequests: number;
  lastSuccessfulRequest?: Date;
  lastFailedRequest?: Date;
}

export interface HealthCheckResult {
  providerId: string;
  channel: Channel;
  isHealthy: boolean;
  status: ProviderHealthStatus;
  metrics: ProviderHealthMetrics;
}

export interface IProviderHealthMonitor {
  /**
   * Check health of a specific provider
   */
  checkProviderHealth(
    providerId: string,
    channel: Channel,
  ): Promise<HealthCheckResult>;

  /**
   * Check health of all providers for a channel
   */
  checkChannelHealth(channel: Channel): Promise<HealthCheckResult[]>;

  /**
   * Check health of all registered providers
   */
  checkAllProvidersHealth(): Promise<HealthCheckResult[]>;

  /**
   * Get health metrics for a provider
   */
  getProviderMetrics(
    providerId: string,
    channel: Channel,
  ): Promise<ProviderHealthMetrics>;

  /**
   * Record a successful request
   */
  recordSuccess(
    providerId: string,
    channel: Channel,
    responseTime: number,
  ): Promise<void>;

  /**
   * Record a failed request
   */
  recordFailure(
    providerId: string,
    channel: Channel,
    error: string,
  ): Promise<void>;

  /**
   * Get providers sorted by health score
   */
  getProvidersByHealth(channel: Channel): Promise<HealthCheckResult[]>;

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs?: number): void;

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void;
}
