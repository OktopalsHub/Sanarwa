import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogSanitizer } from './utils/log-sanitizer.util';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  log(message: string, context?: LogContext) {
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.writeLog('error', message, { ...context, trace });
  }

  warn(message: string, context?: LogContext) {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: LogContext) {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: LogContext) {
    this.writeLog('trace', message, context);
  }

  // Business logic specific logging methods
  logUserAction(action: string, userId: string, context?: LogContext) {
    this.log(`User action: ${action}`, {
      ...context,
      userId,
      category: 'user_action',
    });
  }

  logApiCall(method: string, endpoint: string, duration: number, context?: LogContext) {
    this.log(`API call: ${method} ${endpoint}`, {
      ...context,
      duration,
      category: 'api_call',
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext) {
    this.log('Database query executed', {
      ...context,
      query: this.isProduction ? '[REDACTED]' : query,
      duration,
      category: 'database',
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', context?: LogContext) {
    this.warn(`Security event: ${event}`, {
      ...context,
      severity,
      category: 'security',
    });
  }

  logBusinessEvent(event: string, context?: LogContext) {
    this.log(`Business event: ${event}`, {
      ...context,
      category: 'business',
    });
  }

  private writeLog(level: string, message: string, context?: LogContext) {
    // Sanitize context to remove sensitive data
    const sanitizedContext = context ? LogSanitizer.sanitizeObject(context) : {};
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: LogSanitizer.truncateString(message),
      service: 'sanarwa-api',
      environment: this.configService.get('NODE_ENV', 'development'),
      ...sanitizedContext,
    };

    // Limit log entry size
    const finalLogEntry = LogSanitizer.limitObjectSize(logEntry);

    // In production, write structured JSON
    if (this.isProduction) {
      console.log(JSON.stringify(finalLogEntry));
    } else {
      // In development, use pretty printing
      console.log(`[${level.toUpperCase()}] ${message}`, sanitizedContext || '');
    }
  }
}