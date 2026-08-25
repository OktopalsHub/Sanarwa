import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { Tenant } from "../entities/tenant.entity";

// Extend Express Request interface to include tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor() {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Tenant context is now handled at the project level through API key authentication
    // The tenant context will be set by the project-level authentication middleware
    // This middleware is kept for backward compatibility but does not perform authentication
    next();
  }
}
