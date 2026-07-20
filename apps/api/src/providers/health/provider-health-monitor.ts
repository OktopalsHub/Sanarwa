import { Injectable, Logger } from '@nestjs/common';
import { IBaseProvider } from '../base/base-provider.interface';
import { Channel, ProviderHealth } from '../types';
import {
  HealthCheckResult,
  IProviderHealthMonitor,
  ProviderHealthMetrics,
} from './provider-health.interface';

interface ProviderMetricsData {
  providerId: string;
  channel: Channel;
  totalRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  lastSuccessfulRequest?: Date;
  lastFailedRequest?: Date;
  provider?: IBaseProvider;
}

@Injectable()
export class ProviderHealthMonitor implements IProviderHealthMonitor {
  private readonly logger = new Logger(ProviderHealthMonitor.name);
  private readonly metrics = new Map<string, ProviderMetricsData>();
  private monitoringInterval?: NodeJS.Timeout;
  private readonly providers = new Map<string, IBaseProvider>();

  /**
   * Register a provider for health monitoring
   */
  registerProvider(provider: IBaseProvider): void {
    const key = this.getProviderKey(provider.id, provider.channel);
    this.providers.set(key, provider);

    // Initialize metrics if not exists
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        providerId: provider.id,
        channel: provider.channel,
        totalRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0,
      });
    }

    this.logger.log(
      `Registered provider for health monitoring: ${provider.id} (${provider.channel})`,
    );
  }

  /**
   * Unregister a provider from health monitoring
   */
  unregisterProvider(providerId: string, channel: Channel): void {
    const key = this.getProviderKey(providerId, channel);
    this.providers.delete(key);
    this.metrics.delete(key);

    this.logger.log(
      `Unregistered provider from health monitoring: ${providerId} (${channel})`,
    );
  }

  /**
   * Check health of a specific provider
   */
  async checkProviderHealth(
    providerId: string,
    channel: Channel,
  ): Promise<HealthCheckResult> {
    const key = this.getProviderKey(providerId, channel);
    const provider = this.providers.get(key);

    if (!provider) {
      throw new Error(
        `Provider ${providerId} for channel ${channel} is not registered`,
      );
    }

    try {
      const healthStatus = await provider.checkHealth();
      const metrics = await this.getProviderMetrics(providerId, channel);

      const isHealthy = healthStatus.status === ProviderHealth.HEALTHY;

      return {
        providerId,
        channel,
        isHealthy,
        status: healthStatus,
        metrics,
      };
    } catch (error) {
      this.logger.error(
        `Health check failed for provider ${providerId}:`,
        error,
      );

      const metrics = await this.getProviderMetrics(providerId, channel);

      return {
        providerId,
        channel,
        isHealthy: false,
        status: {
          status: ProviderHealth.UNHEALTHY,
          lastChecked: new Date(),
          metadata: { error: error.message },
        },
        metrics,
      };
    }
  }

  /**
   * Check health of all providers for a channel
   */
  async checkChannelHealth(channel: Channel): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [key, provider] of this.providers) {
      if (provider.channel === channel) {
        try {
          const result = await this.checkProviderHealth(provider.id, channel);
          results.push(result);
        } catch (error) {
          this.logger.error(
            `Failed to check health for provider ${provider.id}:`,
            error,
          );
        }
      }
    }

    return results;
  }

  /**
   * Check health of all registered providers
   */
  async checkAllProvidersHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [, provider] of this.providers) {
      try {
        const result = await this.checkProviderHealth(
          provider.id,
          provider.channel,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to check health for provider ${provider.id}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Get health metrics for a provider
   */
  async getProviderMetrics(
    providerId: string,
    channel: Channel,
  ): Promise<ProviderHealthMetrics> {
    const key = this.getProviderKey(providerId, channel);
    const data = this.metrics.get(key);

    if (!data) {
      throw new Error(
        `No metrics found for provider ${providerId} (${channel})`,
      );
    }

    const provider = this.providers.get(key);
    let healthStatus = {
      status: ProviderHealth.UNKNOWN,
      lastChecked: new Date(),
    };

    if (provider) {
      try {
        healthStatus = await provider.checkHealth();
      } catch (error) {
        this.logger.warn(
          `Failed to get health status for metrics: ${error.message}`,
        );
      }
    }

    const successRate =
      data.totalRequests > 0
        ? ((data.totalRequests - data.failedRequests) / data.totalRequests) *
          100
        : 0;

    const averageResponseTime =
      data.totalRequests > 0 ? data.totalResponseTime / data.totalRequests : 0;

    return {
      providerId,
      channel,
      healthStatus,
      successRate,
      averageResponseTime,
      totalRequests: data.totalRequests,
      failedRequests: data.failedRequests,
      lastSuccessfulRequest: data.lastSuccessfulRequest,
      lastFailedRequest: data.lastFailedRequest,
    };
  }

  /**
   * Record a successful request
   */
  async recordSuccess(
    providerId: string,
    channel: Channel,
    responseTime: number,
  ): Promise<void> {
    const key = this.getProviderKey(providerId, channel);
    const data = this.metrics.get(key);

    if (data) {
      data.totalRequests++;
      data.totalResponseTime += responseTime;
      data.lastSuccessfulRequest = new Date();
    } else {
      this.metrics.set(key, {
        providerId,
        channel,
        totalRequests: 1,
        failedRequests: 0,
        totalResponseTime: responseTime,
        lastSuccessfulRequest: new Date(),
      });
    }
  }

  /**
   * Record a failed request
   */
  async recordFailure(
    providerId: string,
    channel: Channel,
    error: string,
  ): Promise<void> {
    const key = this.getProviderKey(providerId, channel);
    const data = this.metrics.get(key);

    if (data) {
      data.totalRequests++;
      data.failedRequests++;
      data.lastFailedRequest = new Date();
    } else {
      this.metrics.set(key, {
        providerId,
        channel,
        totalRequests: 1,
        failedRequests: 1,
        totalResponseTime: 0,
        lastFailedRequest: new Date(),
      });
    }

    this.logger.warn(
      `Recorded failure for provider ${providerId} (${channel}): ${error}`,
    );
  }

  /**
   * Get providers sorted by health score
   */
  async getProvidersByHealth(channel: Channel): Promise<HealthCheckResult[]> {
    const results = await this.checkChannelHealth(channel);

    // Sort by health status and success rate
    return results.toSorted((a, b) => {
      // Healthy providers first
      if (a.isHealthy && !b.isHealthy) return -1;
      if (!a.isHealthy && b.isHealthy) return 1;

      // Then by success rate
      return b.metrics.successRate - a.metrics.successRate;
    });
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.logger.log(
      `Starting continuous health monitoring with ${intervalMs}ms interval`,
    );

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllProvidersHealth();
      } catch (error) {
        this.logger.error('Error during continuous health monitoring:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.logger.log('Stopped continuous health monitoring');
    }
  }

  /**
   * Clear all metrics data
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.logger.log('Cleared all provider metrics');
  }

  /**
   * Get provider key for internal mapping
   */
  private getProviderKey(providerId: string, channel: Channel): string {
    return `${providerId}:${channel}`;
  }
}
