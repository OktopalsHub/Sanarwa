import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { MetricsService } from "../services/metrics.service";

interface User {
  tenantId?: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Extract tenant ID from request (could be from headers, JWT, etc.)
    const tenantId =
      (req.headers["x-tenant-id"] as string) || (req.user as any)?.tenantId || "unknown";

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.path;

      this.metricsService.recordHttpRequest(req.method, route, res.statusCode, duration, tenantId);
    });

    next();
  }
}
