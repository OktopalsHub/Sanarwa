import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import crypto from "node:crypto"
import { randomUUID } from "node:crypto"

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || randomUUID();

    // Set correlation ID in request
    req.headers['x-correlation-id'] = correlationId;

    // Set correlation ID in response headers
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}