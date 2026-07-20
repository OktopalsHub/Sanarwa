import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DashboardController } from './dashboard.controller';
import { HealthCheckService } from './health-check.service';
import { MetricsService } from './metrics.service';
import { ProviderHealthService } from './provider-health.service';
import { AlertService } from '../alerts/alert.service';

@Module({
  controllers: [HealthController, DashboardController],
  providers: [
    HealthCheckService,
    MetricsService,
    ProviderHealthService,
    AlertService,
  ],
  exports: [
    HealthCheckService,
    MetricsService,
    ProviderHealthService,
  ],
})
export class HealthModule { }