import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  AUDIT_LOG_KEY,
  AuditLogOptions,
} from '../decorators/audit-log.decorator';
import { AuditLogService } from '../services/audit-log.service';
import { StructuredLoggerService } from '../../logging/structured-logger.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
    private readonly logger: StructuredLoggerService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    // Extract resource ID from request parameters
    let resourceId = 'unknown';
    if (
      auditOptions.resourceIdParam &&
      request.params[auditOptions.resourceIdParam]
    ) {
      resourceId = request.params[auditOptions.resourceIdParam];
    } else if (request.params.id) {
      resourceId = request.params.id;
    }

    const baseLogData = {
      tenantId: user?.tenantId || request.headers['x-tenant-id'],
      userId: user?.id,
      action: auditOptions.action,
      resourceType: auditOptions.resourceType,
      resourceId,
      description:
        auditOptions.description ||
        `${auditOptions.action} ${auditOptions.resourceType}`,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent'),
      sessionId: request.sessionID,
      correlationId: request.headers['x-correlation-id'],
      requestId: request.headers['x-request-id'],
      apiVersion: request.headers['api-version'],
      clientVersion: request.headers['client-version'],
    };

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;

        // Log successful operation
        this.auditLogService
          .createAuditLog({
            ...baseLogData,
            success: true,
            duration,
            newValues: auditOptions.includeResponseBody ? response : undefined,
            oldValues: auditOptions.includeRequestBody
              ? request.body
              : undefined,
          })
          .catch((error) => {
            this.logger.error('Failed to create audit log', error.stack, {
              correlationId: request.headers['x-correlation-id'],
              operation: 'audit_log_creation',
              context: baseLogData,
              category: 'audit',
            });
          });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log failed operation
        this.auditLogService
          .createAuditLog({
            ...baseLogData,
            success: false,
            duration,
            errorMessage: error.message,
            oldValues: auditOptions.includeRequestBody
              ? request.body
              : undefined,
          })
          .catch((logError) => {
            this.logger.error('Failed to create audit log', logError.stack, {
              correlationId: request.headers['x-correlation-id'],
              operation: 'audit_log_creation',
              originalError: error?.message,
              category: 'audit',
            });
          });

        throw error;
      }),
    );
  }
}
