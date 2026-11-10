import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { MetricsService as RootMetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./interceptors/metrics.interceptor";
import { MetricsController } from "./metrics.controller";
import { LoggingService } from "./services/logging.service";

@Global()
@Module({
  imports: [ConfigModule, TerminusModule, HttpModule],
  controllers: [MetricsController],
  providers: [RootMetricsService, MetricsInterceptor, LoggingService],
  exports: [RootMetricsService, MetricsInterceptor, LoggingService],
})
export class MonitoringModule {}
