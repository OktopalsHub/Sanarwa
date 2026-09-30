import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { MetricsService } from "../metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Extract controller and handler names
    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;
    const route = `${controllerName}.${handlerName}`;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.recordSuccess(method, route, duration);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.recordError(method, route, duration, error);
        throw error;
      }),
    );
  }

  private recordSuccess(method: string, route: string, duration: number): void {
    try {
      // You can add custom success metrics here
      this.logger.debug(`${method} ${route} completed in ${duration}ms`);
    } catch (error) {
      this.logger.error("Failed to record success metrics", error);
    }
  }

  private recordError(method: string, route: string, duration: number, error: any): void {
    try {
      // You can add custom error metrics here
      this.logger.error(`${method} ${route} failed in ${duration}ms: ${error.message}`);
    } catch (metricsError) {
      this.logger.error("Failed to record error metrics", metricsError);
    }
  }
}
