import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export interface ProviderMetrics {
  providerId: string;
  channel: NotificationChannel;
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
  channel: NotificationChannel;
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

interface ProviderPerformanceRecord {
  id: string;
  providerId: string;
  channel: NotificationChannel;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ProviderPerformanceTracker {
  private readonly logger = new Logger(ProviderPerformanceTracker.name);
  private readonly CACHE_TTL = 60;
  private readonly MAX_RECORDS_PER_PROVIDER = 10000;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async recordSuccess(
    providerId: string,
    channel: NotificationChannel,
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

    await this.addRecord(providerId, channel, record);
    await this.invalidateCache(providerId, channel);

    this.logger.debug(`Recorded success for ${providerId} (${channel}): ${responseTime}ms`);
  }

  async recordFailure(
    providerId: string,
    channel: NotificationChannel,
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

    await this.addRecord(providerId, channel, record);
    await this.invalidateCache(providerId, channel);

    this.logger.debug(`Recorded failure for ${providerId} (${channel}): ${errorMessage}`);
  }

  async getMetrics(providerId: string, channel: NotificationChannel): Promise<ProviderMetrics> {
    const cacheKey = this.getCacheKey(providerId, channel);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const metrics = JSON.parse(cached) as ProviderMetrics;
      if (metrics.lastSuccessfulRequest) {
        metrics.lastSuccessfulRequest = new Date(metrics.lastSuccessfulRequest);
      }
      if (metrics.lastFailedRequest) {
        metrics.lastFailedRequest = new Date(metrics.lastFailedRequest);
      }
      return metrics;
    }

    const metrics = await this.calculateMetrics(providerId, channel);
    await this.redis.set(cacheKey, JSON.stringify(metrics), "EX", this.CACHE_TTL);

    return metrics;
  }

  async getAnalytics(
    providerId: string,
    channel: NotificationChannel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics> {
    const records = await this.getRecordsInRange(providerId, channel, startDate, endDate);

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
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    const sortedResponseTimes = responseTimes.toSorted((a, b) => a - b);
    const p95ResponseTime = this.calculatePercentile(sortedResponseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(sortedResponseTimes, 99);

    const timeRangeSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
    const throughput = totalRequests / timeRangeSeconds;

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
    const throughputTrend = this.calculateTrend(previousAnalytics.metrics.throughput, throughput);

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

  async getTopPerformers(
    channel: NotificationChannel,
    limit: number = 10,
  ): Promise<ProviderMetrics[]> {
    const allMetrics: ProviderMetrics[] = [];

    for (const member of await this.redis.smembers(this.getRegistryKey())) {
      const { providerId, channel: providerChannel } = JSON.parse(member) as {
        providerId: string;
        channel: NotificationChannel;
      };
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

    for (const member of await this.redis.smembers(this.getRegistryKey())) {
      const { providerId, channel } = JSON.parse(member) as {
        providerId: string;
        channel: NotificationChannel;
      };
      const key = this.getDataKey(providerId, channel);
      const records = await this.readRecords(key);
      const filteredRecords = records.filter((record) => record.timestamp > cutoffDate);

      totalRemoved += records.length - filteredRecords.length;

      await this.redis.del(key);
      if (filteredRecords.length === 0) {
        await this.redis.srem(this.getRegistryKey(), member);
      } else {
        await this.writeRecords(key, filteredRecords);
      }
      await this.redis.del(this.getCacheKey(providerId, channel));
    }

    this.logger.log(`Cleaned up ${totalRemoved} old performance records`);
  }

  async getProviderComparison(
    channel: NotificationChannel,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceAnalytics[]> {
    const comparisons: PerformanceAnalytics[] = [];

    for (const member of await this.redis.smembers(this.getRegistryKey())) {
      const { providerId, channel: providerChannel } = JSON.parse(member) as {
        providerId: string;
        channel: NotificationChannel;
      };
      if (providerChannel === channel) {
        comparisons.push(await this.getAnalytics(providerId, channel, startDate, endDate));
      }
    }

    return comparisons.toSorted((a, b) => b.metrics.successRate - a.metrics.successRate);
  }

  private async calculateMetrics(
    providerId: string,
    channel: NotificationChannel,
  ): Promise<ProviderMetrics> {
    const key = this.getDataKey(providerId, channel);
    const records = await this.readRecords(key);

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
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRecords = records.filter((r) => r.timestamp > oneHourAgo);
    const requestsPerMinute = recentRecords.length / 60;

    const lastSuccessfulRequest =
      successfulRequests.length > 0
        ? new Date(Math.max(...successfulRequests.map((r) => r.timestamp.getTime())))
        : undefined;

    const lastFailedRequest =
      failedRequests.length > 0
        ? new Date(Math.max(...failedRequests.map((r) => r.timestamp.getTime())))
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

  private async addRecord(
    providerId: string,
    channel: NotificationChannel,
    record: ProviderPerformanceRecord,
  ): Promise<void> {
    const key = this.getDataKey(providerId, channel);
    await this.redis
      .multi()
      .lpush(key, JSON.stringify(record))
      .ltrim(key, 0, this.MAX_RECORDS_PER_PROVIDER - 1)
      .sadd(this.getRegistryKey(), JSON.stringify({ providerId, channel }))
      .exec();
  }

  private getRegistryKey(): string {
    return "perf:keys";
  }

  private async readRecords(key: string): Promise<ProviderPerformanceRecord[]> {
    const raw = await this.redis.lrange(key, 0, -1);
    return raw.map((item) => {
      const record = JSON.parse(item) as ProviderPerformanceRecord;
      record.timestamp = new Date(record.timestamp);
      return record;
    });
  }

  private async writeRecords(key: string, records: ProviderPerformanceRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }
    await this.redis.rpush(key, ...records.map((record) => JSON.stringify(record)));
  }

  private async getRecordsInRange(
    providerId: string,
    channel: NotificationChannel,
    startDate: Date,
    endDate: Date,
  ): Promise<ProviderPerformanceRecord[]> {
    const records = await this.readRecords(this.getDataKey(providerId, channel));

    return records.filter((record) => record.timestamp >= startDate && record.timestamp <= endDate);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private calculateTrend(previousValue: number, currentValue: number): number {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  private getEmptyAnalytics(
    providerId: string,
    channel: NotificationChannel,
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDataKey(providerId: string, channel: NotificationChannel): string {
    return `perf:records:${providerId}:${channel}`;
  }

  private getCacheKey(providerId: string, channel: NotificationChannel): string {
    return `perf:metrics:${providerId}:${channel}`;
  }

  private async invalidateCache(providerId: string, channel: NotificationChannel): Promise<void> {
    await this.redis.del(this.getCacheKey(providerId, channel));
  }
}
