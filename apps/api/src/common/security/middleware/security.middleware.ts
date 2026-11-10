import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { InputSanitizationService } from "../services/input-sanitization.service";
import { SecurityEventService } from "../services/security-event.service";

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(
    private readonly inputSanitizationService: InputSanitizationService,
    private readonly securityEventService: SecurityEventService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    try {
      if (req.body && typeof req.body === "object") {
        const sanitizationResult = this.inputSanitizationService.sanitizeObject(req.body, {
          preventSqlInjection: true,
          preventXss: true,
          preventCommandInjection: true,
          maxLength: 10000,
        });

        if (sanitizationResult.wasModified) {
          this.logger.warn(`Request body sanitized for ${req.method} ${req.path}`, {
            modifiedFields: sanitizationResult.modifiedFields,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
          });

          await this.securityEventService.logSuspiciousActivity(
            `Malicious input detected in request body`,
            undefined,
            undefined,
            req.ip,
            req.get("User-Agent"),
            {
              method: req.method,
              path: req.path,
              modifiedFields: sanitizationResult.modifiedFields,
            },
          );
        }

        req.body = sanitizationResult.sanitized;
      }

      if (req.query && typeof req.query === "object") {
        let queryModified = false;

        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === "string") {
            const result = this.inputSanitizationService.sanitize(value, {
              preventSqlInjection: true,
              preventXss: true,
              preventCommandInjection: true,
              maxLength: 1000,
            });

            if (result.wasModified) {
              (req.query as any)[key] = result.sanitized;
              queryModified = true;
            }
          }
        }

        if (queryModified) {
          this.logger.warn(`Query parameters sanitized for ${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
          });

          await this.securityEventService.logSuspiciousActivity(
            `Malicious input detected in query parameters`,
            undefined,
            undefined,
            req.ip,
            req.get("User-Agent"),
            {
              method: req.method,
              path: req.path,
              originalQuery: req.query,
            },
          );
        }
      }

      await this.checkSuspiciousHeaders(req);

      this.addSecurityHeaders(res);

      next();
    } catch (error) {
      this.logger.error(`Security middleware error: ${error.message}`, error.stack);
      next(error);
    }
  }

  private async checkSuspiciousHeaders(req: Request): Promise<void> {
    const suspiciousHeaders = [
      "x-forwarded-for",
      "x-real-ip",
      "x-originating-ip",
      "x-cluster-client-ip",
    ];

    for (const header of suspiciousHeaders) {
      const value = req.get(header);
      if (value) {
        const result = this.inputSanitizationService.detectSuspiciousPatterns(value);
        if (result.isSuspicious) {
          await this.securityEventService.logSuspiciousActivity(
            `Suspicious patterns detected in ${header} header`,
            undefined,
            undefined,
            req.ip,
            req.get("User-Agent"),
            {
              header,
              value,
              detectedPatterns: result.detectedPatterns,
              riskLevel: result.riskLevel,
            },
          );
        }
      }
    }
  }

  private addSecurityHeaders(res: Response): void {
    res.setHeader("X-Frame-Options", "DENY");

    res.setHeader("X-Content-Type-Options", "nosniff");

    res.setHeader("X-XSS-Protection", "1; mode=block");

    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    res.setHeader("Content-Security-Policy", "default-src 'self'");

    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  }
}
