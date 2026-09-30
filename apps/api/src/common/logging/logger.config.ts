import { ConfigService } from "@nestjs/config";
import { LoggerModuleAsyncParams } from "nestjs-pino";
import { Request } from "express";

export const loggerConfig: LoggerModuleAsyncParams = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const isProduction = configService.get("NODE_ENV") === "production";
    const logLevel = configService.get("LOG_LEVEL", "info");

    return {
      pinoHttp: {
        level: logLevel,
        transport: !isProduction
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
                singleLine: true,
              },
            }
          : undefined,
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        messageKey: "message",
        customProps: (req: Request) => {
          if (!req) return {};

          return {
            correlationId: req.headers?.["x-correlation-id"] || generateCorrelationId(),
            userAgent: req.headers?.["user-agent"],
            ip: req.ip || req.socket?.remoteAddress,
            userId: (req as any).user?.id,
            tenantId: (req as any).user?.tenantId,
          };
        },
        serializers: {
          req: (req: Request) => {
            if (!req) return {};

            return {
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
              headers: {
                host: req.headers?.host,
                "user-agent": req.headers?.["user-agent"],
                "content-type": req.headers?.["content-type"],
                authorization: req.headers?.authorization ? "[REDACTED]" : undefined,
              },
            };
          },
          res: (res: any) => {
            if (!res) return {};

            const getHeaderValue = (headerName: string) => {
              if (typeof res.getHeader === "function") {
                return res.getHeader(headerName);
              }
              return res.headers?.[headerName];
            };

            return {
              statusCode: res.statusCode,
              headers: {
                "content-type": getHeaderValue("content-type"),
                "content-length": getHeaderValue("content-length"),
              },
            };
          },
          err: (err: Error) => ({
            type: err.constructor.name,
            message: err.message,
            stack: err.stack,
          }),
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.token",
            "req.body.secret",
            "req.body.apiKey",
          ],
          censor: "[REDACTED]",
        },
        autoLogging: {
          ignore: (req: Request) => {
            // Skip logging for health checks and metrics
            return req.url?.includes("/health") || req.url?.includes("/metrics");
          },
        },
      },
    };
  },
};

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
