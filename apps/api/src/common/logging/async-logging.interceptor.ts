import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Request, Response } from "express";

interface LogData {
  correlationId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  tenantId?: string;
  statusCode: number;
  responseTime: number;
  contentLength?: number;
  error?: {
    message: string;
    stack?: string;
    type: string;
  };
}

@Injectable()
export class AsyncLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AsyncLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const logData: Partial<LogData> = {
      correlationId: request.headers["x-correlation-id"] as string,
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: request.ip || request.connection.remoteAddress,
      userId: (request as any).user?.id,
      tenantId: (request as any).user?.tenantId,
    };

    return next.handle().pipe(
      tap(() => {
        // Log successful requests asynchronously
        setImmediate(() => {
          this.logRequest({
            ...logData,
            statusCode: response.statusCode,
            responseTime: Date.now() - startTime,
            contentLength: response.getHeader("content-length") as number,
          } as LogData);
        });
      }),
      catchError((error) => {
        // Log errors asynchronously
        setImmediate(() => {
          this.logRequest({
            ...logData,
            statusCode: response.statusCode || 500,
            responseTime: Date.now() - startTime,
            error: {
              message: error.message,
              stack: error.stack,
              type: error.constructor.name,
            },
          } as LogData);
        });
        throw error;
      }),
    );
  }

  private logRequest(data: LogData) {
    const { error, responseTime, statusCode, ...logContext } = data;

    if (error) {
      this.logger.error(
        `${data.method} ${data.url} - ${statusCode} - ${responseTime}ms - ${error.message}`,
        {
          ...logContext,
          responseTime,
          statusCode,
          error,
        },
      );
    } else if (statusCode >= 400) {
      this.logger.warn(`${data.method} ${data.url} - ${statusCode} - ${responseTime}ms`, {
        ...logContext,
        responseTime,
        statusCode,
      });
    } else {
      this.logger.log(`${data.method} ${data.url} - ${statusCode} - ${responseTime}ms`, {
        ...logContext,
        responseTime,
        statusCode,
      });
    }
  }
}
