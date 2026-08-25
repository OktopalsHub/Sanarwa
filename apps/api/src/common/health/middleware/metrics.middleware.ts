import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { MetricsService } from "../../monitoring/services/metrics.service";

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MetricsMiddleware.name);

  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const method = req.method;
    const originalUrl = req.originalUrl;

    // Extract route pattern (remove query params and IDs)
    const route = this.extractRoute(originalUrl);

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      try {
        // Record HTTP request metrics
        this.metricsService.recordHttpRequest(method, route, statusCode, duration);
      } catch (error) {
        this.logger.error("Failed to record HTTP metrics", error);
      }
    });

    next();
  }

  private extractRoute(url: string): string {
    // Remove query parameters
    const path = url.split("?")[0];

    // Replace UUIDs and numeric IDs with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/\d+/g, "/:id")
      .replace(/\/[a-f0-9]{24}/g, "/:id"); // MongoDB ObjectIds
  }
}
