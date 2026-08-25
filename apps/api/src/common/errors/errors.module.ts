import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AlertModule } from "../alerts/alert.module";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { ValidationExceptionFilter } from "./filters/validation-exception.filter";
import { ErrorClassificationService } from "./services/error-classification.service";
import { CircuitBreakerService } from "./services/circuit-breaker.service";
import { ErrorRecoveryService } from "./services/error-recovery.service";
import { GlobalErrorInterceptor } from "../interceptors/global-error.interceptor";

@Module({
  imports: [AlertModule],
  providers: [
    // Services
    ErrorClassificationService,
    CircuitBreakerService,
    ErrorRecoveryService,
    // Filters
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    // Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalErrorInterceptor,
    },
  ],
  exports: [ErrorClassificationService, CircuitBreakerService, ErrorRecoveryService],
})
export class ErrorsModule {}
