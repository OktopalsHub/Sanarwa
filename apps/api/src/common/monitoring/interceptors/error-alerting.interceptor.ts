import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { LoggingService } from "../services/logging.service";

@Injectable()
export class ErrorAlertingInterceptor implements NestInterceptor {
  constructor(private loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const statusCode = this.getStatusCode(error);

        this.loggingService.error("Request error", error, {
          method: request.method,
          url: request.url,
          statusCode,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
          tenantId: request.headers["x-tenant-id"] || request.user?.tenantId,
        });

        return throwError(() => error);
      }),
    );
  }

  private getStatusCode(error: any): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
