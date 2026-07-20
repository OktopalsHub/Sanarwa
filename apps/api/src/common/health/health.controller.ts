import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { HealthCheckService } from './health-check.service';
import { MetricsService } from './metrics.service';
import { ProviderHealthService } from './provider-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly metricsService: MetricsService,
    private readonly providerHealthService: ProviderHealthService,
  ) { }

  @Public()
  @Get()
  async getHealth() {
    return await this.healthCheckService.getHealthStatus();
  }

  @Public()
  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Service is alive',
    };
  }

  @Public()
  @Get('ready')
  async getReadiness() {
    const health = await this.healthCheckService.getHealthStatus();

    return {
      status: health.status === 'unhealthy' ? 'not ready' : 'ready',
      timestamp: health.timestamp,
      checks: health.checks,
    };
  }

  @Public()
  @Get('detailed')
  async getDetailedHealth() {
    const [systemHealth, providerHealth, metricsHealth] = await Promise.all([
      this.healthCheckService.getHealthStatus(),
      this.providerHealthService.getProviderHealthSummary(),
      this.metricsService.getHealthMetrics(),
    ]);

    return {
      system: systemHealth,
      providers: providerHealth,
      metrics: metricsHealth.metrics,
      alerts: metricsHealth.alerts,
      overallStatus: this.determineOverallStatus(systemHealth.status, providerHealth.overallStatus, metricsHealth.healthy),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('providers')
  async getProviderHealth() {
    return await this.providerHealthService.getProviderHealthSummary();
  }

  @Public()
  @Get('metrics')
  async getMetrics() {
    return await this.metricsService.getSystemMetrics();
  }

  @Public()
  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain')
  async getPrometheusMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getPrometheusMetrics();
    res.send(metrics);
  }

  @Public()
  @Get('startup')
  getStartupHealth() {
    // Quick health check for startup probes
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Service started successfully',
    };
  }

  private determineOverallStatus(
    systemStatus: string,
    providerStatus: string,
    metricsHealthy: boolean,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (systemStatus === 'unhealthy' || !metricsHealthy) {
      return 'unhealthy';
    }

    if (systemStatus === 'degraded' || providerStatus === 'unhealthy') {
      return 'degraded';
    }

    if (providerStatus === 'degraded') {
      return 'degraded';
    }

    return 'healthy';
  }
}
