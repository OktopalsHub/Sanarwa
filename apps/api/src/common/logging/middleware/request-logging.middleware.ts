import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { StructuredLoggerService } from "../structured-logger.service";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const correlationId = req.headers["x-correlation-id"] as string;

    // Log incoming request
    this.logger.log("Incoming request", {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
      category: "http_request",
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const contentLength = res.getHeader("content-length");

      // Log response
      setImmediate(() => {
        const logLevel = res.statusCode >= 400 ? "warn" : "log";
        const logger = (this as any).logger;

        logger[logLevel]("Request completed", {
          correlationId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          contentLength,
          userId: (req as any).user?.id,
          tenantId: (req as any).user?.tenantId,
          category: "http_response",
        });
      });

      originalEnd.call(this, chunk, encoding);
    }.bind({ logger: this.logger });

    next();
  }
}
