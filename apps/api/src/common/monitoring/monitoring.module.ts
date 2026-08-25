import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { MetricsService as RootMetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./interceptors/metrics.interceptor";
import { MetricsController } from "./metrics.controller";
import { AlertingService } from "./services/alerting.service";
import { LoggingService } from "./services/logging.service";
import { MetricsService } from "./services/metrics.service";
import { ProviderHealthService } from "./services/provider-health.service";

@Global()
@Module({
  imports: [ConfigModule, TerminusModule, HttpModule],
  controllers: [MetricsController],
  providers: [
    RootMetricsService,
    MetricsService,
    MetricsInterceptor,
    AlertingService,
    LoggingService,
    ProviderHealthService,
  ],
  exports: [
    RootMetricsService,
    MetricsService,
    MetricsInterceptor,
    AlertingService,
    LoggingService,
    ProviderHealthService,
  ],
})
export class MonitoringModule {}
