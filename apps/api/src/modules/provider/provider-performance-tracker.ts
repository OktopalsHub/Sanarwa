import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "../../providers/types";
import {
  buildPerformanceAnalytics,
  calculateMetricsFromRecords,
  filterRecordsInRange,
} from "./provider-performance.metrics";
import {
  PerformanceAnalytics,
  ProviderMetrics,
  ProviderPerformanceRecord,
  generatePerformanceRecordId,
  getProviderDataKey,
  getProviderMetricsCacheKey,
} from "./provider-performance.types";

export type { PerformanceAnalytics, ProviderMetrics } from "./provider-performance.types";

@Injectable()
export class ProviderPerformanceTracker {
  private readonly logger = new Logger(ProviderPerformanceTracker.name);
  private readonly performanceData = new Map<string, ProviderPerformanceRecord[]>();
  private readonly metricsCache = new Map<string, { metrics: ProviderMetrics; timestamp: Date }>();
  private readonly CACHE_TTL = 60000;
  private readonly MAX_RECORDS_PER_PROVIDER = 10000;

  async recordSuccess(
    providerId: string,
    channel: Channel,
    responseTime: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const record: ProviderPerformanceRecord = {
      id: generatePerformanceRecordId(),
      providerId,
      channel,
      timestamp: new Date(),
      success: true,
      responseTime,
      metadata,
    };

    this.addRecord(providerId, channel, record);
    this.invalidateCache(providerId, channel);

    this.logger.debug(`Recorded success for ${providerId} (${channel}): ${responseTime}ms`);
  }

  async recordFailure(
    providerId: string,
    channel: Channel,
    errorMessage: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const record: ProviderPerformanceRecord = {
      id: generatePerformanceRecordId(),
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

    this.logger.debug(`Recorded failure for ${providerId} (${channel}): ${errorMessage}`);
  }

  async getMetrics(providerId: string, channel: Channel): Promise<ProviderMetrics> {
    const cacheKey = getProviderMetricsCacheKey(providerId, channel);
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.metrics;
    }

    const key = getProviderDataKey(providerId, channel);
    const metrics = calculateMetricsFromRecords(
      this.performanceData.get(key) || [],
      providerId,
      channel,
    );
    this.metricsCache.set(cacheKey, { metrics, timestamp: new Date() });

    return metrics;
  }

  async getAnalytics(
    providerId: string,
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics> {
    const key = getProviderDataKey(providerId, channel);
    const records = filterRecordsInRange(
      this.performanceData.get(key) || [],
      startDate,
      endDate,
    );

    const previousPeriodStart = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );
    const previousAnalytics = await this.getAnalytics(
      providerId,
      channel,
      previousPeriodStart,
      startDate,
    );

    return buildPerformanceAnalytics(
      records,
      providerId,
      channel,
      startDate,
      endDate,
      previousAnalytics.metrics.totalRequests > 0 ? previousAnalytics.metrics : undefined,
    );
  }

  async getTopPerformers(channel: Channel, limit: number = 10): Promise<ProviderMetrics[]> {
    const allMetrics: ProviderMetrics[] = [];

    for (const [key] of this.performanceData) {
      const [providerId, providerChannel] = key.split(":");
      if (providerChannel === channel) {
        allMetrics.push(await this.getMetrics(providerId, channel));
      }
    }

    return allMetrics
      .toSorted((a, b) => {
        if (a.successRate !== b.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageResponseTime - b.averageResponseTime;
      })
      .slice(0, limit);
  }

  async cleanupOldData(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let totalRemoved = 0;

    for (const [key, records] of this.performanceData) {
      const filteredRecords = records.filter((record) => record.timestamp > cutoffDate);
      totalRemoved += records.length - filteredRecords.length;

      if (filteredRecords.length === 0) {
        this.performanceData.delete(key);
      } else {
        this.performanceData.set(key, filteredRecords);
      }
    }

    this.metricsCache.clear();
    this.logger.log(`Cleaned up ${totalRemoved} old performance records`);
  }

  async getProviderComparison(
    channel: Channel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics[]> {
    const comparisons: PerformanceAnalytics[] = [];

    for (const [key] of this.performanceData) {
      const [providerId, providerChannel] = key.split(":");
      if (providerChannel === channel) {
        comparisons.push(await this.getAnalytics(providerId, channel, startDate, endDate));
      }
    }

    return comparisons.toSorted((a, b) => b.metrics.successRate - a.metrics.successRate);
  }

  private addRecord(providerId: string, channel: Channel, record: ProviderPerformanceRecord): void {
    const key = getProviderDataKey(providerId, channel);
    const records = this.performanceData.get(key) || [];

    records.push(record);

    if (records.length > this.MAX_RECORDS_PER_PROVIDER) {
      records.splice(0, records.length - this.MAX_RECORDS_PER_PROVIDER);
    }

    this.performanceData.set(key, records);
  }

  private invalidateCache(providerId: string, channel: Channel): void {
    this.metricsCache.delete(getProviderMetricsCacheKey(providerId, channel));
  }
}
