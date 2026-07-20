import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertingService } from '../services/alerting.service';
import { LoggingService } from '../services/logging.service';

@Injectable()
export class ErrorAlertingInterceptor implements NestInterceptor {
  constructor(
    private alertingService: AlertingService,
    private loggingService: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Determine if this is a 5xx error that should trigger alerts
        const statusCode = this.getStatusCode(error);
        const isCriticalError = statusCode >= 500;

        if (isCriticalError) {
          // Send alert for critical errors (5xx)
          this.sendCriticalErrorAlert(error, request, statusCode);
        }

        // Log the error
        this.loggingService.error('Request error', error, {
          method: request.method,
          url: request.url,
          statusCode,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          tenantId: request.headers['x-tenant-id'] || request.user?.tenantId,
        });

        return throwError(() => error);
      }),
    );
  }

  private getStatusCode(error: any): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    // Default to 500 for unknown errors
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private async sendCriticalErrorAlert(
    error: any,
    request: any,
    statusCode: number,
  ) {
    try {
      await this.alertingService.sendAlert({
        type: 'system_error',
        severity: 'critical',
        title: `Critical Error: ${statusCode}`,
        message: `A critical error occurred in the notification platform: ${error.message}`,
        metadata: {
          statusCode,
          method: request.method,
          url: request.url,
          errorName: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
          tenantId:
            request.headers['x-tenant-id'] ||
            request.user?.tenantId ||
            'unknown',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (alertError) {
      // Don't let alerting errors break the main error flow
      this.loggingService.error(
        'Failed to send critical error alert',
        alertError,
      );
    }
  }
}
