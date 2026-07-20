import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorClassificationService } from '../errors/services/error-classification.service';

@Injectable()
export class GlobalErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GlobalErrorInterceptor.name);

  constructor(
    private readonly errorClassificationService: ErrorClassificationService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      this.generateCorrelationId();

    return next.handle().pipe(
      catchError((error) => {
        const classifiedError = this.errorClassificationService.classifyError(
          error,
          {
            correlationId,
            method: request.method,
            url: request.url,
            userAgent: request.get('User-Agent'),
            ip: request.ip,
            userId: request.user?.id,
            tenantId: request.member?.tenantId,
          },
        );

        // Log the error with proper context
        this.logger.error(
          `${classifiedError.code}: ${classifiedError.message}`,
          {
            correlationId,
            error: classifiedError.originalError?.stack,
            context: classifiedError.context,
            severity: classifiedError.severity,
            category: classifiedError.category,
          },
        );

        // Add correlation ID to response headers
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-Correlation-ID', correlationId);

        return throwError(() => classifiedError.originalError || error);
      }),
    );
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}