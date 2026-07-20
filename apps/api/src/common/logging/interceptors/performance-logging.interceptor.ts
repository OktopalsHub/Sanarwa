import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { StructuredLoggerService } from '../structured-logger.service';
import {
  LOG_PERFORMANCE_KEY,
  LogPerformanceOptions,
} from '../decorators/log-performance.decorator';

@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: StructuredLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const performanceOptions = this.reflector.get<LogPerformanceOptions>(
      LOG_PERFORMANCE_KEY,
      context.getHandler(),
    );

    if (!performanceOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const { operation, threshold = 1000, includeArgs, includeResult, category } = performanceOptions;

    const baseContext = {
      correlationId: request.headers['x-correlation-id'],
      userId: request.user?.id,
      tenantId: request.user?.tenantId,
      operation,
      category: category || 'performance',
    };

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        const logContext = {
          ...baseContext,
          duration,
          success: true,
          ...(includeArgs && { args: this.sanitizeArgs(context.getArgs()) }),
          ...(includeResult && { result: this.sanitizeResult(result) }),
        };

        if (duration > threshold) {
          this.logger.warn(`Slow operation detected: ${operation}`, logContext);
        } else {
          this.logger.log(`Operation completed: ${operation}`, logContext);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const logContext = {
          ...baseContext,
          duration,
          success: false,
          error: error.message,
          ...(includeArgs && { args: this.sanitizeArgs(context.getArgs()) }),
        };

        this.logger.error(`Operation failed: ${operation}`, error.stack, logContext);
        throw error;
      }),
    );
  }

  private sanitizeArgs(args: any[]): any {
    // Remove sensitive data from arguments
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        // Remove common sensitive fields
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.secret;
        delete sanitized.apiKey;
        return sanitized;
      }
      return arg;
    });
  }

  private sanitizeResult(result: any): any {
    if (typeof result === 'object' && result !== null) {
      const sanitized = { ...result };
      // Remove sensitive fields from result
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.secret;
      delete sanitized.apiKey;
      return sanitized;
    }
    return result;
  }
}