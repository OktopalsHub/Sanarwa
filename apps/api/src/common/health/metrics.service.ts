import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as promClient from 'prom-client';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  database: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    queryCount: number;
    avgQueryTime: number;
  };
  redis: {
    connectedClients: number;
    usedMemory: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    commandsProcessed: number;
  };
  http: {
    requestsTotal: number;
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
  };
  notifications: {
    sentTotal: number;
    sentPerMinute: number;
    failureRate: number;
    queueSize: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startTime = Date.now();

  // Prometheus metrics
  private readonly httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private readonly httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private readonly notificationsSent = new promClient.Counter({
    name: 'notifications_sent_total',
    help: 'Total number of notifications sent',
    labelNames: ['type', 'provider', 'status'],
  });

  private readonly notificationDuration = new promClient.Histogram({
    name: 'notification_duration_seconds',
    help: 'Duration of notification processing in seconds',
    labelNames: ['type', 'provider'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  private readonly queueSize = new promClient.Gauge({
    name: 'queue_size',
    help: 'Current queue size',
    labelNames: ['queue_name'],
  });

  private readonly activeConnections = new promClient.Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
  });

  private readonly memoryUsage = new promClient.Gauge({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    labelNames: ['type'],
  });

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    // Register default metrics
    promClient.collectDefaultMetrics({
      prefix: 'sanarwa_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    // Start metrics collection
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();

      // Update memory metrics
      this.memoryUsage.set({ type: 'heap_used' }, memoryUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total' }, memoryUsage.heapTotal);
      this.memoryUsage.set({ type: 'rss' }, memoryUsage.rss);
      this.memoryUsage.set({ type: 'external' }, memoryUsage.external);

      // Collect Redis metrics
      await this.collectRedisMetrics();
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  private async collectRedisMetrics(): Promise<void> {
    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');

      const stats: Record<string, string> = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      // Update Redis metrics
      if (stats.connected_clients) {
        this.activeConnections.set(parseInt(stats.connected_clients));
      }
    } catch (error) {
      this.logger.error('Failed to collect Redis metrics', error);
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = require('os').loadavg();

    // Get Redis info
    const redisInfo = await this.getRedisInfo();

    return {
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage,
      },
      database: {
        activeConnections: 0, // TODO: Get from TypeORM
        idleConnections: 0,
        totalConnections: 0,
        queryCount: 0,
        avgQueryTime: 0,
      },
      redis: redisInfo,
      http: {
        requestsTotal: 0, // TODO: Implement request counter
        requestsPerSecond: 0,
        avgResponseTime: 0,
        errorRate: 0,
      },
      notifications: {
        sentTotal: 0, // TODO: Get from notification service
        sentPerMinute: 0,
        failureRate: 0,
        queueSize: 0,
      },
    };
  }

  private async getRedisInfo(): Promise<SystemMetrics['redis']> {
    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');

      const stats: Record<string, string> = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        connectedClients: parseInt(stats.connected_clients || '0'),
        usedMemory: parseInt(stats.used_memory || '0'),
        keyspaceHits: parseInt(stats.keyspace_hits || '0'),
        keyspaceMisses: parseInt(stats.keyspace_misses || '0'),
        commandsProcessed: parseInt(stats.total_commands_processed || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get Redis info', error);
      return {
        connectedClients: 0,
        usedMemory: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        commandsProcessed: 0,
      };
    }
  }

  // Prometheus metrics methods
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  recordNotification(type: string, provider: string, status: 'success' | 'failure', duration: number): void {
    this.notificationsSent.inc({ type, provider, status });
    this.notificationDuration.observe({ type, provider }, duration / 1000);
  }

  updateQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  async getPrometheusMetrics(): Promise<string> {
    return await promClient.register.metrics();
  }

  async getHealthMetrics(): Promise<{
    healthy: boolean;
    metrics: SystemMetrics;
    alerts: string[];
  }> {
    const metrics = await this.getSystemMetrics();
    const alerts: string[] = [];
    let healthy = true;

    // Check memory thresholds
    const heapUsedMB = metrics.memory.heapUsed / 1024 / 1024;
    const rssUsedMB = metrics.memory.rss / 1024 / 1024;

    const heapWarningMB = this.configService.get<number>('MEMORY_HEAP_WARNING_MB', 512);
    const heapCriticalMB = this.configService.get<number>('MEMORY_HEAP_CRITICAL_MB', 1024);
    const rssWarningMB = this.configService.get<number>('MEMORY_RSS_WARNING_MB', 1024);
    const rssCriticalMB = this.configService.get<number>('MEMORY_RSS_CRITICAL_MB', 2048);

    if (heapUsedMB > heapCriticalMB) {
      alerts.push(`Critical heap memory usage: ${heapUsedMB.toFixed(1)}MB`);
      healthy = false;
    } else if (heapUsedMB > heapWarningMB) {
      alerts.push(`High heap memory usage: ${heapUsedMB.toFixed(1)}MB`);
    }

    if (rssUsedMB > rssCriticalMB) {
      alerts.push(`Critical RSS memory usage: ${rssUsedMB.toFixed(1)}MB`);
      healthy = false;
    } else if (rssUsedMB > rssWarningMB) {
      alerts.push(`High RSS memory usage: ${rssUsedMB.toFixed(1)}MB`);
    }

    // Check CPU load
    const avgLoad = metrics.cpu.loadAverage[0];
    if (avgLoad > 2.0) {
      alerts.push(`High CPU load: ${avgLoad.toFixed(2)}`);
      if (avgLoad > 4.0) {
        healthy = false;
      }
    }

    return { healthy, metrics, alerts };
  }
}