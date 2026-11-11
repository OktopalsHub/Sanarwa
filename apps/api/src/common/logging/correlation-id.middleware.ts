import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers["x-correlation-id"];
    const correlationId =
      typeof incoming === "string" && SAFE_CORRELATION_ID.test(incoming) ? incoming : randomUUID();

    req.headers["x-correlation-id"] = correlationId;

    res.setHeader("x-correlation-id", correlationId);

    next();
  }
}
