import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './logger.config';
import { StructuredLoggerService } from './structured-logger.service';
import { AsyncLoggingInterceptor } from './async-logging.interceptor';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
import { PerformanceLoggingInterceptor } from './interceptors/performance-logging.interceptor';
import { LoggingHealthIndicator } from './health/logging-health.indicator';
import { LogRotationService } from './utils/log-rotation.util';

@Global()
@Module({
  imports: [LoggerModule.forRootAsync(loggerConfig)],
  providers: [
    StructuredLoggerService,
    AsyncLoggingInterceptor,
    CorrelationIdMiddleware,
    RequestLoggingMiddleware,
    PerformanceLoggingInterceptor,
    LoggingHealthIndicator,
    LogRotationService,
  ],
  exports: [
    StructuredLoggerService,
    AsyncLoggingInterceptor,
    CorrelationIdMiddleware,
    RequestLoggingMiddleware,
    PerformanceLoggingInterceptor,
    LoggingHealthIndicator,
    LogRotationService,
  ],
})
export class LoggingModule { }