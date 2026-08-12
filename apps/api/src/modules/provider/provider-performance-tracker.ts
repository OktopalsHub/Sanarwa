import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '../../providers/types';

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
    throughput: number; // requests per second
  };
  trends: {
    successRateTrend: number; // percentage change
    responseTimeTrend: number; // percentage change
    throughputTrend: number; // percentage change
  };
}

interface ProviderPerformanceRecord {
  id: string;
  providerId: string;
  channel: Channel;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ProviderPerformanceTracker {
  private readonly logger = new Logger(ProviderPerformanceTracker.name);
  private readonly performanceData = new Map<
    string,
    ProviderPerformanceRecord[]
  >();
  private readonly metricsCache = new Map<
    string,
    { metrics: ProviderMetrics; timestamp: Date }
  >();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly MAX_RECORDS_PER_PROVIDER = 10000;

  /**
   * Record a successful provider operation
   */
  async recordSuccess(
    providerId: string,
    channel: Channel,
    responseTime: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const record: ProviderPerformanceRecord = {
      id: this.generateId(),
      providerId,
      channel,
      timestamp: new Date(),
      success: true,
      responseTime,
      metadata,
    };

    this.addRecord(providerId, channel, record);
    this.invalidateCache(providerId, channel);

    this.logger.debug(
      `Recorded success for ${providerId} (${channel}): ${responseTime}ms`,
    );
  }

  /**
   * Record a failed provider operation
   */
  async recordFailure(
    providerId: string,
    channel: Channel,
    errorMessage: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const record: ProviderPerformanceRecord = {
      id: this.generateId(),
      providerId,
      channel,
      timestamp: new Date(),
      success: false,
      responseTime: 0,
      errorMessage,
      metadata,
    };

    this.addRecord(providerId, channel, record);
    this.invalidateCache(providerId, channel);

    this.logger.debug(
      `Recorded failure for ${providerId} (${channel}): ${errorMessage}`,
    );
  }

  /**
   * Get current metrics for a provider
   */
  async getMetrics(
    providerId: string,
    channel: Channel,
  ): Promise<ProviderMetrics> {
    const cacheKey = this.getCacheKey(providerId, channel);
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.metrics;
    }

    const metrics = await this.calculateMetrics(providerId, channel);
    this.metricsCache.set(cacheKey, { metrics, timestamp: new Date() });

    return metrics;
  }

  /**
   * Get performance analytics for a time range
   */
  async getAnalytics(
    providerId: string,
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics> {
    const records = this.getRecordsInRange(
      providerId,
      channel,
      startDate,
      endDate,
    );

    if (records.length === 0) {
      return this.getEmptyAnalytics(providerId, channel, startDate, endDate);
    }

    const successfulRequests = records.filter((r) => r.success);
    const failedRequests = records.filter((r) => !r.success);
    const responseTimes = successfulRequests.map((r) => r.responseTime);

    const totalRequests = records.length;
    const successRate = (successfulRequests.length / totalRequests) * 100;
    const errorRate = (failedRequests.length / totalRequests) * 100;
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    // Calculate percentiles
    const sortedResponseTimes = responseTimes.toSorted((a, b) => a - b);
    const p95ResponseTime = this.calculatePercentile(sortedResponseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(sortedResponseTimes, 99);

    // Calculate throughput (requests per second)
    const timeRangeSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
    const throughput = totalRequests / timeRangeSeconds;

    // Calculate trends (compare with previous period)
    const previousPeriodStart = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );
    const previousPeriodEnd = startDate;
    const previousAnalytics = await this.getAnalytics(
      providerId,
      channel,
      previousPeriodStart,
      previousPeriodEnd,
    );

    const successRateTrend = this.calculateTrend(
      previousAnalytics.metrics.successRate,
      successRate,
    );
    const responseTimeTrend = this.calculateTrend(
      previousAnalytics.metrics.averageResponseTime,
      averageResponseTime,
    );
    const throughputTrend = this.calculateTrend(
      previousAnalytics.metrics.throughput,
      throughput,
    );

    return {
      providerId,
      channel,
      timeRange: { start: startDate, end: endDate },
      metrics: {
        totalRequests,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        successRate,
        errorRate,
        throughput,
      },
      trends: {
        successRateTrend,
        responseTimeTrend,
        throughputTrend,
      },
    };
  }

  /**
   * Get top performing providers for a channel
   */
  async getTopPerformers(
    channel: Channel,
    limit: number = 10,
  ): Promise<ProviderMetrics[]> {
    const allMetrics: ProviderMetrics[] = [];

    for (const [key] of this.performanceData) {
      const [providerId, providerChannel] = key.split(':');
      if (providerChannel === channel) {
        const metrics = await this.getMetrics(providerId, channel);
        allMetrics.push(metrics);
      }
    }

    // Sort by success rate and response time
    return allMetrics
      .toSorted((a, b) => {
        if (a.successRate !== b.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageResponseTime - b.averageResponseTime;
      })
      .slice(0, limit);
  }

  /**
   * Clear old performance data
   */
  async cleanupOldData(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let totalRemoved = 0;

    for (const [key, records] of this.performanceData) {
      const filteredRecords = records.filter(
        (record) => record.timestamp > cutoffDate,
      );

      const removedCount = records.length - filteredRecords.length;
      totalRemoved += removedCount;

      if (filteredRecords.length === 0) {
        this.performanceData.delete(key);
      } else {
        this.performanceData.set(key, filteredRecords);
      }
    }

    // Clear cache
    this.metricsCache.clear();

    this.logger.log(`Cleaned up ${totalRemoved} old performance records`);
  }

  /**
   * Get provider comparison report
   */
  async getProviderComparison(
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics[]> {
    const comparisons: PerformanceAnalytics[] = [];

    for (const [key] of this.performanceData) {
      const [providerId, providerChannel] = key.split(':');
      if (providerChannel === channel) {
        const analytics = await this.getAnalytics(
          providerId,
          channel,
          startDate,
          endDate,
        );
        comparisons.push(analytics);
      }
    }

    return comparisons.toSorted(
      (a, b) => b.metrics.successRate - a.metrics.successRate,
    );
  }

  /**
   * Calculate current metrics for a provider
   */
  private async calculateMetrics(
    providerId: string,
    channel: Channel,
  ): Promise<ProviderMetrics> {
    const key = this.getDataKey(providerId, channel);
    const records = this.performanceData.get(key) || [];

    if (records.length === 0) {
      return {
        providerId,
        channel,
        successRate: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        requestsPerMinute: 0,
        errorRate: 0,
      };
    }

    const successfulRequests = records.filter((r) => r.success);
    const failedRequests = records.filter((r) => !r.success);
    const totalRequests = records.length;

    const successRate = (successfulRequests.length / totalRequests) * 100;
    const errorRate = (failedRequests.length / totalRequests) * 100;

    const responseTimes = successfulRequests.map((r) => r.responseTime);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    // Calculate requests per minute for last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRecords = records.filter((r) => r.timestamp > oneHourAgo);
    const requestsPerMinute = recentRecords.length / 60;

    const lastSuccessfulRequest =
      successfulRequests.length > 0
        ? new Date(
            Math.max(...successfulRequests.map((r) => r.timestamp.getTime())),
          )
        : undefined;

    const lastFailedRequest =
      failedRequests.length > 0
        ? new Date(
            Math.max(...failedRequests.map((r) => r.timestamp.getTime())),
          )
        : undefined;

    return {
      providerId,
      channel,
      successRate,
      averageResponseTime,
      totalRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      lastSuccessfulRequest,
      lastFailedRequest,
      requestsPerMinute,
      errorRate,
    };
  }

  /**
   * Add a performance record
   */
  private addRecord(
    providerId: string,
    channel: Channel,
    record: ProviderPerformanceRecord,
  ): void {
    const key = this.getDataKey(providerId, channel);
    const records = this.performanceData.get(key) || [];

    records.push(record);

    // Keep only the most recent records
    if (records.length > this.MAX_RECORDS_PER_PROVIDER) {
      records.splice(0, records.length - this.MAX_RECORDS_PER_PROVIDER);
    }

    this.performanceData.set(key, records);
  }

  /**
   * Get records within a time range
   */
  private getRecordsInRange(
    providerId: string,
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): ProviderPerformanceRecord[] {
    const key = this.getDataKey(providerId, channel);
    const records = this.performanceData.get(key) || [];

    return records.filter(
      (record) => record.timestamp >= startDate && record.timestamp <= endDate,
    );
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(
    sortedArray: number[],
    percentile: number,
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Calculate trend percentage
   */
  private calculateTrend(previousValue: number, currentValue: number): number {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  /**
   * Get empty analytics structure
   */
  private getEmptyAnalytics(
    providerId: string,
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): PerformanceAnalytics {
    return {
      providerId,
      channel,
      timeRange: { start: startDate, end: endDate },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        successRate: 0,
        errorRate: 0,
        throughput: 0,
      },
      trends: {
        successRateTrend: 0,
        responseTimeTrend: 0,
        throughputTrend: 0,
      },
    };
  }

  /**
   * Generate unique ID for records
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get data key for provider
   */
  private getDataKey(providerId: string, channel: Channel): string {
    return `${providerId}:${channel}`;
  }

  /**
   * Get cache key for metrics
   */
  private getCacheKey(providerId: string, channel: Channel): string {
    return `metrics:${providerId}:${channel}`;
  }

  /**
   * Invalidate metrics cache
   */
  private invalidateCache(providerId: string, channel: Channel): void {
    const cacheKey = this.getCacheKey(providerId, channel);
    this.metricsCache.delete(cacheKey);
  }
}
