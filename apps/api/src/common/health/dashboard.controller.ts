import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../../modules/auth/decorators/public.decorator";
import { HealthCheckService } from "./health-check.service";
import { MetricsService } from "./metrics.service";
import { ProviderHealthService } from "./provider-health.service";

interface DashboardAlert {
  id: string;
  severity: string;
  title: string;
  message: string;
  timestamp: Date;
  category: string;
}

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly metricsService: MetricsService,
    private readonly providerHealthService: ProviderHealthService,
  ) {}

  @Public()
  @Get("status")
  async getDashboardStatus() {
    const [systemHealth, providerHealth, metrics] = await Promise.all([
      this.healthCheckService.getHealthStatus(),
      this.providerHealthService.getProviderHealthSummary(),
      this.metricsService.getSystemMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      system: {
        status: systemHealth.status,
        uptime: systemHealth.uptime,
        version: systemHealth.version,
        checks: Object.keys(systemHealth.checks).reduce((acc, key) => {
          acc[key] = {
            status: systemHealth.checks[key].status,
            responseTime: systemHealth.checks[key].responseTime,
          };
          return acc;
        }, {}),
      },
      providers: {
        total: providerHealth.totalProviders,
        healthy: providerHealth.healthyProviders,
        degraded: providerHealth.degradedProviders,
        unhealthy: providerHealth.unhealthyProviders,
        status: providerHealth.overallStatus,
      },
      performance: {
        memory: {
          heapUsedMB: Math.round(metrics.memory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(metrics.memory.heapTotal / 1024 / 1024),
          rssMB: Math.round(metrics.memory.rss / 1024 / 1024),
        },
        cpu: {
          usage: metrics.cpu.usage,
          loadAverage: metrics.cpu.loadAverage[0],
        },
        redis: {
          connectedClients: metrics.redis.connectedClients,
          usedMemoryMB: Math.round(metrics.redis.usedMemory / 1024 / 1024),
        },
      },
    };
  }

  @Public()
  @Get("alerts")
  async getActiveAlerts(@Query("severity") severity?: string) {
    const healthMetrics = await this.metricsService.getHealthMetrics();
    const systemHealth = await this.healthCheckService.getHealthStatus();
    const providerHealth = await this.providerHealthService.getProviderHealthSummary();

    const alerts: DashboardAlert[] = [];

    // System alerts
    if (systemHealth.status === "unhealthy") {
      const unhealthyChecks = Object.entries(systemHealth.checks)
        .filter(([, check]) => check.status === "unhealthy")
        .map(([name]) => name);

      alerts.push({
        id: "system-unhealthy",
        severity: "critical",
        title: "System Health Critical",
        message: `System components are unhealthy: ${unhealthyChecks.join(", ")}`,
        timestamp: systemHealth.timestamp,
        category: "system",
      });
    }

    // Provider alerts
    if (providerHealth.unhealthyProviders > 0) {
      const unhealthyProviders = providerHealth.providers
        .filter((p) => p.status === "unhealthy")
        .map((p) => p.provider);

      alerts.push({
        id: "providers-unhealthy",
        severity: "high",
        title: "Provider Health Issues",
        message: `${providerHealth.unhealthyProviders} providers are unhealthy: ${unhealthyProviders.join(", ")}`,
        timestamp: new Date(),
        category: "providers",
      });
    }

    // Memory alerts
    healthMetrics.alerts.forEach((alert, index) => {
      alerts.push({
        id: `memory-alert-${index}`,
        severity: alert.includes("Critical") ? "critical" : "warning",
        title: "Memory Usage Alert",
        message: alert,
        timestamp: new Date(),
        category: "performance",
      });
    });

    // Filter by severity if provided
    const filteredAlerts = severity
      ? alerts.filter((alert) => alert.severity === severity)
      : alerts;

    return {
      total: filteredAlerts.length,
      alerts: filteredAlerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get("overview")
  async getSystemOverview() {
    const [systemHealth, providerHealth, metrics] = await Promise.all([
      this.healthCheckService.getHealthStatus(),
      this.providerHealthService.getProviderHealthSummary(),
      this.metricsService.getSystemMetrics(),
    ]);

    const overallStatus = this.determineOverallStatus(
      systemHealth.status,
      providerHealth.overallStatus,
    );

    return {
      status: overallStatus,
      uptime: systemHealth.uptime,
      timestamp: new Date().toISOString(),
      summary: {
        system: {
          status: systemHealth.status,
          healthyChecks: Object.values(systemHealth.checks).filter((c) => c.status === "healthy")
            .length,
          totalChecks: Object.keys(systemHealth.checks).length,
        },
        providers: {
          status: providerHealth.overallStatus,
          healthy: providerHealth.healthyProviders,
          total: providerHealth.totalProviders,
        },
        performance: {
          memoryUsagePercent: Math.round(
            (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100,
          ),
          cpuLoad: metrics.cpu.loadAverage[0],
          redisConnections: metrics.redis.connectedClients,
        },
      },
      quickStats: {
        totalRequests: metrics.http.requestsTotal,
        notificationsSent: metrics.notifications.sentTotal,
        errorRate: metrics.http.errorRate,
        avgResponseTime: metrics.http.avgResponseTime,
      },
    };
  }

  private determineOverallStatus(
    systemStatus: string,
    providerStatus: string,
  ): "healthy" | "degraded" | "unhealthy" {
    if (systemStatus === "unhealthy") {
      return "unhealthy";
    }

    if (systemStatus === "degraded" || providerStatus === "unhealthy") {
      return "degraded";
    }

    if (providerStatus === "degraded") {
      return "degraded";
    }

    return "healthy";
  }
}
