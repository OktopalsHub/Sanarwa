import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from '../messaging/message-delivery.entity';
import {
  Message as Notification,
  MessageChannel as NotificationChannel,
} from '../messaging/message.entity';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface SystemPerformanceMetrics {
  throughput: {
    notificationsPerSecond: number;
    deliveriesPerSecond: number;
    peakThroughput: number;
  };
  latency: {
    averageProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
    averageDeliveryTime: number;
  };
  reliability: {
    successRate: number;
    errorRate: number;
    retryRate: number;
    uptime: number;
  };
  resource: {
    queueDepth: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface ProviderPerformanceMetrics {
  providerId: string;
  channel: NotificationChannel;
  metrics: {
    responseTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
    availability: number;
  };
  timestamp: Date;
}

export interface TenantPerformanceMetrics {
  tenantId: string;
  metrics: {
    totalNotifications: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
    quotaUsage: number;
    quotaLimit: number;
  };
  timestamp: Date;
}

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private readonly metrics: PerformanceMetric[] = [];
  private readonly startTime = Date.now();
  private metricsCollectionInterval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepository: Repository<NotificationDelivery>,
  ) {
    // Start collecting system metrics periodically
    this.startMetricsCollection();
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>,
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only the last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics.splice(0, this.metrics.length - 10000);
    }

    this.logger.debug(`Metric recorded: ${name} = ${value} ${unit}`);
  }

  /**
   * Record notification processing time
   */
  recordNotificationProcessingTime(
    notificationId: string,
    processingTimeMs: number,
    tenantId: string,
    channel: NotificationChannel,
  ): void {
    this.recordMetric('notification.processing_time', processingTimeMs, 'ms', {
      notificationId,
      tenantId,
      channel,
    });
  }

  /**
   * Record provider response time
   */
  recordProviderResponseTime(
    providerId: string,
    channel: NotificationChannel,
    responseTimeMs: number,
    success: boolean,
  ): void {
    this.recordMetric('provider.response_time', responseTimeMs, 'ms', {
      providerId,
      channel,
      success: success.toString(),
    });

    this.recordMetric('provider.request_count', 1, 'count', {
      providerId,
      channel,
      success: success.toString(),
    });
  }

  /**
   * Record queue metrics
   */
  recordQueueMetrics(
    queueName: string,
    depth: number,
    processingRate: number,
  ): void {
    this.recordMetric('queue.depth', depth, 'count', { queueName });

    this.recordMetric('queue.processing_rate', processingRate, 'jobs/sec', {
      queueName,
    });
  }

  /**
   * Record delivery metrics
   */
  recordDeliveryMetrics(
    channel: NotificationChannel,
    status: DeliveryStatus,
    deliveryTimeMs?: number,
  ): void {
    this.recordMetric('delivery.count', 1, 'count', {
      channel,
      status,
    });

    if (deliveryTimeMs !== undefined) {
      this.recordMetric('delivery.time', deliveryTimeMs, 'ms', {
        channel,
        status,
      });
    }
  }

  /**
   * Get system performance metrics
   */
  async getSystemPerformanceMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<SystemPerformanceMetrics> {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endDate || now;

    // Get notifications in time range
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.createdAt >= :start', { start })
      .andWhere('notification.createdAt <= :end', { end })
      .getMany();

    // Get deliveries in time range
    const deliveries = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.createdAt >= :start', { start })
      .andWhere('delivery.createdAt <= :end', { end })
      .getMany();

    // Calculate throughput
    const timeRangeSeconds = (end.getTime() - start.getTime()) / 1000;
    const notificationsPerSecond = notifications.length / timeRangeSeconds;
    const deliveriesPerSecond = deliveries.length / timeRangeSeconds;

    // Calculate processing times
    const processingTimes = this.getMetricValues(
      'notification.processing_time',
      start,
      end,
    );

    const deliveryTimes = deliveries
      .filter((d) => d.sentAt && d.deliveredAt)
      .map((d) => d.deliveredAt!.getTime() - d.sentAt!.getTime());

    // Calculate success/error rates
    const successfulDeliveries = deliveries.filter(
      (d) => d.status === DeliveryStatus.DELIVERED,
    ).length;
    const failedDeliveries = deliveries.filter(
      (d) => d.status === DeliveryStatus.FAILED,
    ).length;
    const totalDeliveries = deliveries.length;

    const successRate =
      totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
    const errorRate =
      totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0;

    // Calculate retry rate
    const retriedNotifications = notifications.filter(
      (n) => n.retryCount > 0,
    ).length;
    const retryRate =
      notifications.length > 0
        ? (retriedNotifications / notifications.length) * 100
        : 0;

    // Calculate uptime (simplified - time since service start)
    const uptimeMs = Date.now() - this.startTime;
    const uptime = (uptimeMs / (24 * 60 * 60 * 1000)) * 100; // Percentage of day

    return {
      throughput: {
        notificationsPerSecond: Math.round(notificationsPerSecond * 100) / 100,
        deliveriesPerSecond: Math.round(deliveriesPerSecond * 100) / 100,
        peakThroughput: Math.max(notificationsPerSecond, deliveriesPerSecond),
      },
      latency: {
        averageProcessingTime: this.calculateAverage(processingTimes),
        p95ProcessingTime: this.calculatePercentile(processingTimes, 95),
        p99ProcessingTime: this.calculatePercentile(processingTimes, 99),
        averageDeliveryTime: this.calculateAverage(deliveryTimes),
      },
      reliability: {
        successRate: Math.round(successRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        retryRate: Math.round(retryRate * 100) / 100,
        uptime: Math.min(uptime, 100),
      },
      resource: {
        queueDepth: this.getLatestMetricValue('queue.depth') || 0,
        activeConnections:
          this.getLatestMetricValue('system.active_connections') || 0,
        memoryUsage: this.getLatestMetricValue('system.memory_usage') || 0,
        cpuUsage: this.getLatestMetricValue('system.cpu_usage') || 0,
      },
    };
  }

  /**
   * Get provider performance metrics
   */
  async getProviderPerformanceMetrics(
    providerId?: string,
    channel?: NotificationChannel,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProviderPerformanceMetrics[]> {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = endDate || now;

    // Get deliveries for the provider/channel
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.createdAt >= :start', { start })
      .andWhere('delivery.createdAt <= :end', { end });

    if (providerId) {
      queryBuilder.andWhere('delivery.providerId = :providerId', {
        providerId,
      });
    }

    if (channel) {
      queryBuilder.andWhere('delivery.channel = :channel', { channel });
    }

    const deliveries = await queryBuilder.getMany();

    // Group by provider and channel
    const providerGroups = deliveries.reduce(
      (acc, delivery) => {
        const key = `${delivery.providerId}-${delivery.channel}`;
        if (!acc[key]) {
          acc[key] = {
            providerId: delivery.providerId,
            channel: delivery.channel,
            deliveries: [],
          };
        }
        acc[key].deliveries.push(delivery);
        return acc;
      },
      {} as Record<
        string,
        {
          providerId: string;
          channel: NotificationChannel;
          deliveries: NotificationDelivery[];
        }
      >,
    );

    const providerMetrics: ProviderPerformanceMetrics[] = [];

    for (const group of Object.values(providerGroups)) {
      const {
        providerId: pid,
        channel: ch,
        deliveries: providerDeliveries,
      } = group;

      // Get response times from metrics
      const responseTimes = this.getMetricValues(
        'provider.response_time',
        start,
        end,
        { providerId: pid, channel: ch },
      );

      // Calculate metrics
      const totalRequests = providerDeliveries.length;
      const successfulRequests = providerDeliveries.filter(
        (d) =>
          d.status === DeliveryStatus.DELIVERED ||
          d.status === DeliveryStatus.SENT,
      ).length;
      const failedRequests = providerDeliveries.filter(
        (d) => d.status === DeliveryStatus.FAILED,
      ).length;

      const successRate =
        totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
      const errorRate =
        totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
      const throughput =
        totalRequests / ((end.getTime() - start.getTime()) / 1000);
      const averageResponseTime = this.calculateAverage(responseTimes);

      // Simplified availability calculation
      const availability = successRate > 95 ? 100 : successRate;

      providerMetrics.push({
        providerId: pid,
        channel: ch,
        metrics: {
          responseTime: Math.round(averageResponseTime),
          successRate: Math.round(successRate * 100) / 100,
          errorRate: Math.round(errorRate * 100) / 100,
          throughput: Math.round(throughput * 100) / 100,
          availability: Math.round(availability * 100) / 100,
        },
        timestamp: now,
      });
    }

    return providerMetrics.sort(
      (a, b) => b.metrics.throughput - a.metrics.throughput,
    );
  }

  /**
   * Get tenant performance metrics
   */
  async getTenantPerformanceMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TenantPerformanceMetrics> {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = endDate || now;

    // Get notifications for tenant
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', { tenantId })
      .andWhere('notification.createdAt >= :start', { start })
      .andWhere('notification.createdAt <= :end', { end })
      .getMany();

    // Get deliveries for tenant
    const deliveries = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .innerJoin('delivery.notification', 'notification')
      .where('notification.tenantId = :tenantId', { tenantId })
      .andWhere('delivery.createdAt >= :start', { start })
      .andWhere('delivery.createdAt <= :end', { end })
      .getMany();

    const totalNotifications = notifications.length;
    const successfulDeliveries = deliveries.filter(
      (d) => d.status === DeliveryStatus.DELIVERED,
    ).length;
    const failedDeliveries = deliveries.filter(
      (d) => d.status === DeliveryStatus.FAILED,
    ).length;

    // Calculate average delivery time
    const deliveryTimes = deliveries
      .filter((d) => d.sentAt && d.deliveredAt)
      .map((d) => d.deliveredAt!.getTime() - d.sentAt!.getTime());

    const averageDeliveryTime = this.calculateAverage(deliveryTimes);

    // Simplified quota calculation (would come from tenant configuration in real implementation)
    const quotaUsage = totalNotifications;
    const quotaLimit = 10000; // Default limit

    return {
      tenantId,
      metrics: {
        totalNotifications,
        successfulDeliveries,
        failedDeliveries,
        averageDeliveryTime: Math.round(averageDeliveryTime),
        quotaUsage,
        quotaLimit,
      },
      timestamp: now,
    };
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(
    metricName: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' = 'hour',
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const metrics = this.getMetricValues(metricName, startDate, endDate);

    // Group metrics by time interval
    const timeGroups = new Map<string, number[]>();

    metrics.forEach((value, index) => {
      const metric = this.metrics.find(
        (m) =>
          m.name === metricName &&
          m.timestamp >= startDate &&
          m.timestamp <= endDate,
      );

      if (metric) {
        const timeKey = this.getTimeKey(metric.timestamp, interval);
        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, []);
        }
        timeGroups.get(timeKey)!.push(value);
      }
    });

    // Calculate averages for each time period
    const trends: Array<{ timestamp: Date; value: number }> = [];

    for (const [timeKey, values] of timeGroups.entries()) {
      const timestamp = this.parseTimeKey(timeKey, interval);
      const value = this.calculateAverage(values);
      trends.push({ timestamp, value });
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get real-time metrics dashboard data
   */
  getRealTimeMetrics(): {
    currentThroughput: number;
    averageLatency: number;
    errorRate: number;
    queueDepth: number;
    activeProviders: number;
  } {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const recentProcessingTimes = this.getMetricValues(
      'notification.processing_time',
      fiveMinutesAgo,
      now,
    );

    const recentDeliveries = this.getMetricValues(
      'delivery.count',
      fiveMinutesAgo,
      now,
    );

    const recentErrors = this.getMetricValues(
      'delivery.count',
      fiveMinutesAgo,
      now,
      { status: DeliveryStatus.FAILED },
    );

    const currentThroughput = recentDeliveries.length / (5 * 60); // per second
    const averageLatency = this.calculateAverage(recentProcessingTimes);
    const errorRate =
      recentDeliveries.length > 0
        ? (recentErrors.length / recentDeliveries.length) * 100
        : 0;
    const queueDepth = this.getLatestMetricValue('queue.depth') || 0;

    // Count unique providers from recent metrics
    const activeProviders = new Set(
      this.metrics
        .filter(
          (m) =>
            m.name === 'provider.response_time' &&
            m.timestamp >= fiveMinutesAgo,
        )
        .map((m) => m.tags?.providerId)
        .filter(Boolean),
    ).size;

    return {
      currentThroughput: Math.round(currentThroughput * 100) / 100,
      averageLatency: Math.round(averageLatency),
      errorRate: Math.round(errorRate * 100) / 100,
      queueDepth,
      activeProviders,
    };
  }

  /**
   * Private helper methods
   */

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    this.metricsCollectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Unref the timer to prevent it from keeping the process alive
    this.metricsCollectionInterval.unref();
  }

  /**
   * Stop metrics collection (for cleanup)
   */
  stopMetricsCollection(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }
  }

  private collectSystemMetrics(): void {
    // In a real implementation, these would collect actual system metrics
    this.recordMetric('system.memory_usage', Math.random() * 100, 'percent');
    this.recordMetric('system.cpu_usage', Math.random() * 100, 'percent');
    this.recordMetric(
      'system.active_connections',
      Math.floor(Math.random() * 100),
      'count',
    );
  }

  private getMetricValues(
    name: string,
    startDate: Date,
    endDate: Date,
    tags?: Record<string, string>,
  ): number[] {
    return this.metrics
      .filter((metric) => {
        if (metric.name !== name) return false;
        if (metric.timestamp < startDate || metric.timestamp > endDate)
          return false;

        if (tags) {
          for (const [key, value] of Object.entries(tags)) {
            if (metric.tags?.[key] !== value) return false;
          }
        }

        return true;
      })
      .map((metric) => metric.value);
  }

  private getLatestMetricValue(
    name: string,
    tags?: Record<string, string>,
  ): number | undefined {
    const filteredMetrics = this.metrics
      .filter((metric) => {
        if (metric.name !== name) return false;

        if (tags) {
          for (const [key, value] of Object.entries(tags)) {
            if (metric.tags?.[key] !== value) return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filteredMetrics[0]?.value;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getTimeKey(date: Date, interval: 'hour' | 'day'): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();

    switch (interval) {
      case 'hour':
        return `${year}-${month}-${day}-${hour}`;
      case 'day':
        return `${year}-${month}-${day}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private parseTimeKey(timeKey: string, interval: 'hour' | 'day'): Date {
    const parts = timeKey.split('-').map(Number);

    switch (interval) {
      case 'hour':
        return new Date(parts[0], parts[1], parts[2], parts[3]);
      case 'day':
        return new Date(parts[0], parts[1], parts[2]);
      default:
        return new Date(parts[0], parts[1], parts[2]);
    }
  }
}
