import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: client.Registry;

  // Application metrics
  private httpRequestsTotal: client.Counter<string>;
  private httpRequestDuration: client.Histogram<string>;
  private notificationsSentTotal: client.Counter<string>;
  private notificationFailuresTotal: client.Counter<string>;
  private providerHealthGauge: client.Gauge<string>;
  private queueSizeGauge: client.Gauge<string>;
  private activeConnectionsGauge: client.Gauge<string>;
  private memoryUsageGauge: client.Gauge<string>;
  private cpuUsageGauge: client.Gauge<string>;

  constructor(private configService: ConfigService) {
    this.register = new client.Registry();

    // Set default labels
    this.register.setDefaultLabels({
      app: 'notification-platform',
      version: this.configService.get<string>('APP_VERSION', '1.0.0'),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
    });

    // Initialize metrics
    this.initializeMetrics();

    // Collect default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({ register: this.register });
  }

  private initializeMetrics() {
    // HTTP request metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      registers: [this.register],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    // Notification metrics
    this.notificationsSentTotal = new client.Counter({
      name: 'notifications_sent_total',
      help: 'Total number of notifications sent',
      labelNames: ['channel', 'provider', 'tenant_id', 'status'],
      registers: [this.register],
    });

    this.notificationFailuresTotal = new client.Counter({
      name: 'notification_failures_total',
      help: 'Total number of notification failures',
      labelNames: ['channel', 'provider', 'tenant_id', 'error_type'],
      registers: [this.register],
    });

    // Provider health metrics
    this.providerHealthGauge = new client.Gauge({
      name: 'provider_health_status',
      help: 'Provider health status (1 = healthy, 0 = unhealthy)',
      labelNames: ['provider_id', 'channel', 'tenant_id'],
      registers: [this.register],
    });

    // Queue metrics
    this.queueSizeGauge = new client.Gauge({
      name: 'queue_size',
      help: 'Number of jobs in queue',
      labelNames: ['queue_name', 'status'],
      registers: [this.register],
    });

    // Connection metrics
    this.activeConnectionsGauge = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.register],
    });

    // System metrics
    this.memoryUsageGauge = new client.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register],
    });

    this.cpuUsageGauge = new client.Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.register],
    });
  }

  // HTTP metrics
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    tenantId?: string,
  ) {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      tenant_id: tenantId || 'unknown',
    });

    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000, // Convert to seconds
    );
  }

  // Notification metrics
  recordNotificationSent(
    channel: string,
    provider: string,
    tenantId: string,
    status: 'success' | 'failure',
  ) {
    this.notificationsSentTotal.inc({
      channel,
      provider,
      tenant_id: tenantId,
      status,
    });
  }

  recordNotificationFailure(
    channel: string,
    provider: string,
    tenantId: string,
    errorType: string,
  ) {
    this.notificationFailuresTotal.inc({
      channel,
      provider,
      tenant_id: tenantId,
      error_type: errorType,
    });
  }

  // Provider health metrics
  setProviderHealth(
    providerId: string,
    channel: string,
    tenantId: string,
    isHealthy: boolean,
  ) {
    this.providerHealthGauge.set(
      { provider_id: providerId, channel, tenant_id: tenantId },
      isHealthy ? 1 : 0,
    );
  }

  // Queue metrics
  setQueueSize(queueName: string, status: string, size: number) {
    this.queueSizeGauge.set({ queue_name: queueName, status }, size);
  }

  // Connection metrics
  setActiveConnections(type: string, count: number) {
    this.activeConnectionsGauge.set({ type }, count);
  }

  // System metrics
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.memoryUsageGauge.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsageGauge.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsageGauge.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsageGauge.set({ type: 'external' }, memUsage.external);

    // CPU usage (simplified - in production, use more sophisticated monitoring)
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.cpuUsageGauge.set(totalUsage);
  }

  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    this.updateSystemMetrics();
    return this.register.metrics();
  }

  // Get specific metric values
  async getMetricValue(metricName: string): Promise<any> {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics.find((metric) => metric.name === metricName);
  }

  // Reset all metrics (useful for testing)
  resetMetrics() {
    this.register.resetMetrics();
  }
}
