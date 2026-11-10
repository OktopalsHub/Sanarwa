import { Global, Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { loggerConfig } from "./logger.config";
import { StructuredLoggerService } from "./structured-logger.service";
import { AsyncLoggingInterceptor } from "./async-logging.interceptor";
import { CorrelationIdMiddleware } from "./correlation-id.middleware";
import { RequestLoggingMiddleware } from "./middleware/request-logging.middleware";
import { PerformanceLoggingInterceptor } from "./interceptors/performance-logging.interceptor";
import { LogRotationService } from "./utils/log-rotation.util";

@Global()
@Module({
  imports: [LoggerModule.forRootAsync(loggerConfig)],
  providers: [
    StructuredLoggerService,
    AsyncLoggingInterceptor,
    CorrelationIdMiddleware,
    RequestLoggingMiddleware,
    PerformanceLoggingInterceptor,
    LogRotationService,
  ],
  exports: [
    StructuredLoggerService,
    AsyncLoggingInterceptor,
    CorrelationIdMiddleware,
    RequestLoggingMiddleware,
    PerformanceLoggingInterceptor,
    LogRotationService,
  ],
})
export class LoggingModule {}
