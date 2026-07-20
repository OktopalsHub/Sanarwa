import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: promClient.Registry;
  
  // HTTP Metrics
  private readonly httpRequestsTotal: promClient.Counter<string>;
  private readonly httpRequestDuration: promClient.Histogram<string>;
  private readonly httpRequestsInProgress: promClient.Gauge<string>;
  
  // Business Metrics
  private readonly activeUsers: promClient.Gauge<string>;
  private readonly userActions: promClient.Counter<string>;
  private readonly businessEvents: promClient.Counter<string>;
  
  // Database Metrics
  private readonly databaseQueries: promClient.Counter<string>;
  private readonly databaseQueryDuration: promClient.Histogram<string>;
  private readonly databaseConnections: promClient.Gauge<string>;
  
  // Security Metrics
  private readonly securityEvents: promClient.Counter<string>;
  private readonly failedLogins: promClient.Counter<string>;
  private readonly rateLimitHits: promClient.Counter<string>;
  
  // System Metrics
  private readonly memoryUsage: promClient.Gauge<string>;
  private readonly cpuUsage: promClient.Gauge<string>;

  constructor(private readonly configService: ConfigService) {
    this.register = new promClient.Registry();
    
    // Add default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({ register: this.register });

    // HTTP Metrics
    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status', 'tenant_id'],
      registers: [this.register],
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.httpRequestsInProgress = new promClient.Gauge({
      name: 'http_requests_in_progress',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.register],
    });

    // Business Metrics
    this.activeUsers = new promClient.Gauge({
      name: 'active_users_total',
      help: 'Number of currently active users',
      labelNames: ['tenant_id'],
      registers: [this.register],
    });

    this.userActions = new promClient.Counter({
      name: 'user_actions_total',
      help: 'Total number of user actions',
      labelNames: ['action', 'tenant_id', 'user_id'],
      registers: [this.register],
    });

    this.businessEvents = new promClient.Counter({
      name: 'business_events_total',
      help: 'Total number of business events',
      labelNames: ['event_type', 'tenant_id'],
      registers: [this.register],
    });

    // Database Metrics
    this.databaseQueries = new promClient.Counter({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
      registers: [this.register],
    });

    this.databaseQueryDuration = new promClient.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.databaseConnections = new promClient.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.register],
    });

    // Security Metrics
    this.securityEvents = new promClient.Counter({
      name: 'security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'tenant_id'],
      registers: [this.register],
    });

    this.failedLogins = new promClient.Counter({
      name: 'failed_logins_total',
      help: 'Total number of failed login attempts',
      labelNames: ['tenant_id', 'ip_address'],
      registers: [this.register],
    });

    this.rateLimitHits = new promClient.Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint', 'ip_address'],
      registers: [this.register],
    });

    // System Metrics
    this.memoryUsage = new promClient.Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register],
    });

    this.cpuUsage = new promClient.Gauge({
      name: 'nodejs_cpu_usage_percent',
      help: 'Node.js CPU usage percentage',
      registers: [this.register],
    });

    // Update system metrics periodically
    setInterval(() => {
      this.updateSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  // HTTP Metrics Methods
  incrementHttpRequests(method: string, route: string, status: number, tenantId?: string) {
    this.httpRequestsTotal.inc({
      method,
      route,
      status: status.toString(),
      tenant_id: tenantId || 'unknown',
    });
  }

  observeHttpDuration(method: string, route: string, status: number, duration: number) {
    this.httpRequestDuration.observe(
      {
        method,
        route,
        status: status.toString(),
      },
      duration / 1000 // Convert to seconds
    );
  }

  incrementHttpInProgress(method: string, route: string) {
    this.httpRequestsInProgress.inc({ method, route });
  }

  decrementHttpInProgress(method: string, route: string) {
    this.httpRequestsInProgress.dec({ method, route });
  }

  // Business Metrics Methods
  setActiveUsers(count: number, tenantId?: string) {
    this.activeUsers.set({ tenant_id: tenantId || 'all' }, count);
  }

  incrementUserAction(action: string, tenantId?: string, userId?: string) {
    this.userActions.inc({
      action,
      tenant_id: tenantId || 'unknown',
      user_id: userId || 'unknown',
    });
  }

  incrementBusinessEvent(eventType: string, tenantId?: string) {
    this.businessEvents.inc({
      event_type: eventType,
      tenant_id: tenantId || 'unknown',
    });
  }

  // Database Metrics Methods
  incrementDatabaseQuery(operation: string, table: string, status: 'success' | 'error') {
    this.databaseQueries.inc({ operation, table, status });
  }

  observeDatabaseQueryDuration(operation: string, table: string, duration: number) {
    this.databaseQueryDuration.observe(
      { operation, table },
      duration / 1000 // Convert to seconds
    );
  }

  setDatabaseConnections(count: number) {
    this.databaseConnections.set(count);
  }

  // Security Metrics Methods
  incrementSecurityEvent(eventType: string, severity: string, tenantId?: string) {
    this.securityEvents.inc({
      event_type: eventType,
      severity,
      tenant_id: tenantId || 'unknown',
    });
  }

  incrementFailedLogin(tenantId?: string, ipAddress?: string) {
    this.failedLogins.inc({
      tenant_id: tenantId || 'unknown',
      ip_address: ipAddress || 'unknown',
    });
  }

  incrementRateLimitHit(endpoint: string, ipAddress?: string) {
    this.rateLimitHits.inc({
      endpoint,
      ip_address: ipAddress || 'unknown',
    });
  }

  // System Metrics Methods
  private updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);

    // CPU usage calculation (simplified)
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    this.cpuUsage.set(totalUsage / 1000000); // Convert to seconds
  }

  // Get metrics for Prometheus endpoint
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Get registry for custom metrics
  getRegistry(): promClient.Registry {
    return this.register;
  }
}