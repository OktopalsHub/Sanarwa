import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as winston from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";

export interface LogContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  component?: string;
  operation?: string;
  [key: string]: any;
}

@Injectable()
export class LoggingService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const logLevel = this.configService.get<string>("LOG_LEVEL", "info");
    const logDir = this.configService.get<string>("LOG_DIR", "logs");

    // Create custom format
    const customFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const logEntry: any = {
          timestamp,
          level,
          message,
          ...meta,
        };
        if (stack) {
          logEntry.stack = stack;
        }
        return JSON.stringify(logEntry);
      }),
    );

    // Configure transports
    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
    ];

    // File transports for production
    if (this.configService.get<string>("NODE_ENV") === "production") {
      // General application logs
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/application-%DATE%.log`,
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "14d",
          level: logLevel,
          format: customFormat,
        }),
      );

      // Error logs
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/error-%DATE%.log`,
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
          level: "error",
          format: customFormat,
        }),
      );

      // Audit logs
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/audit-%DATE%.log`,
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "90d",
          format: customFormat,
        }),
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format: customFormat,
      transports,
      exitOnError: false,
    });
  }

  info(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.logger.error(message, {
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    });
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }

  audit(event: string, context: LogContext) {
    this.logger.info(`AUDIT: ${event}`, {
      ...context,
      audit: true,
    });
  }

  // Structured logging for different components
  logNotificationSent(notificationId: string, channel: string, context?: LogContext) {
    this.info("Notification sent", {
      ...context,
      notificationId,
      channel,
      component: "notification",
      operation: "send",
    });
  }

  logProviderFailure(providerId: string, error: Error, context?: LogContext) {
    this.error("Provider failure", error, {
      ...context,
      providerId,
      component: "provider",
      operation: "send",
    });
  }

  logSecurityEvent(
    event: string,
    severity: "low" | "medium" | "high" | "critical",
    context?: LogContext,
  ) {
    this.warn(`SECURITY: ${event}`, {
      ...context,
      severity,
      component: "security",
      security: true,
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context?: LogContext) {
    this.info(`PERFORMANCE: ${metric}`, {
      ...context,
      metric,
      value,
      unit,
      component: "performance",
    });
  }
}
