import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { ValidationExceptionFilter } from "./filters/validation-exception.filter";
import { ErrorClassificationService } from "./services/error-classification.service";
import { CircuitBreakerService } from "./services/circuit-breaker.service";
import { ErrorRecoveryService } from "./services/error-recovery.service";
import { GlobalErrorInterceptor } from "../interceptors/global-error.interceptor";

@Module({
  providers: [
    ErrorClassificationService,
    CircuitBreakerService,
    ErrorRecoveryService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalErrorInterceptor,
    },
  ],
  exports: [ErrorClassificationService, CircuitBreakerService, ErrorRecoveryService],
})
export class ErrorsModule {}
