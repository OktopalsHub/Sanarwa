import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError, finalize } from "rxjs/operators";
import { Request, Response } from "express";
import { MetricsService } from "../metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const method = request.method;
    const route = this.getRoute(request);
    const tenantId = (request as any).user?.tenantId;

    // Increment in-progress requests
    this.metricsService.incrementHttpInProgress(method, route);

    return next.handle().pipe(
      tap(() => {
        // Success case
        const duration = Date.now() - startTime;
        const status = response.statusCode;

        this.metricsService.incrementHttpRequests(method, route, status, tenantId);
        this.metricsService.observeHttpDuration(method, route, status, duration);
      }),
      catchError((error) => {
        // Error case
        const duration = Date.now() - startTime;
        const status = response.statusCode || 500;

        this.metricsService.incrementHttpRequests(method, route, status, tenantId);
        this.metricsService.observeHttpDuration(method, route, status, duration);

        throw error;
      }),
      finalize(() => {
        // Always decrement in-progress requests
        this.metricsService.decrementHttpInProgress(method, route);
      }),
    );
  }

  private getRoute(request: Request): string {
    // Try to get the route pattern from NestJS
    const route = (request as any).route?.path;
    if (route) {
      return route;
    }

    // Fallback to URL path with parameter normalization
    let path = request.url.split("?")[0];

    // Replace UUIDs with :id
    path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id");

    // Replace numeric IDs with :id
    path = path.replace(/\/\d+/g, "/:id");

    return path;
  }
}
