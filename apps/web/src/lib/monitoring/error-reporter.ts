import * as Sentry from "@sentry/react";

export interface ErrorContext {
  context?: string;
  user?: {
    id?: string;
    email?: string;
    tenantId?: string;
  };
  extra?: Record<string, any>;
  tags?: Record<string, string>;
  level?: "error" | "warning" | "info" | "debug";
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

class ErrorReporter {
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;

    // Sentry is initialized in sentry.client.config.ts and sentry.server.config.ts
    this.isInitialized = true;
  }

  reportError(error: Error | string, context?: ErrorContext): string {
    this.initialize();

    const errorId = Sentry.captureException(error, {
      user: context?.user,
      extra: context?.extra,
      tags: context?.tags,
      level: context?.level || "error",
    });

    // Only log critical errors to console in development
    if (process.env.NODE_ENV === "development" && context?.level === "error") {
      console.error("Critical error reported:", error);
    }

    return errorId;
  }

  reportMessage(message: string, context?: ErrorContext): string {
    this.initialize();

    const messageId = Sentry.captureMessage(message, {
      user: context?.user,
      extra: context?.extra,
      tags: context?.tags,
      level: context?.level || "info",
    });

    // Don't log messages in development unless they're warnings or errors
    if (
      process.env.NODE_ENV === "development" &&
      (context?.level === "warning" || context?.level === "error")
    ) {
      console.log("Message reported:", message);
    }

    return messageId;
  }

  setUser(user: { id?: string; email?: string; tenantId?: string }) {
    this.initialize();

    Sentry.setUser({
      id: user.id,
      email: user.email,
      tenant_id: user.tenantId,
    });
  }

  setContext(key: string, context: Record<string, any>) {
    this.initialize();
    Sentry.setContext(key, context);
  }

  addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
    this.initialize();

    Sentry.addBreadcrumb({
      message,
      category: category || "custom",
      data,
      timestamp: Date.now() / 1000,
    });
  }

  recordPerformanceMetric(metric: PerformanceMetric) {
    this.initialize();

    // Record custom metric
    Sentry.metrics.gauge(metric.name, metric.value, {
      unit: metric.unit || "none",
      tags: metric.tags,
    });

    // Don't log performance metrics in development
  }

  startTransaction(name: string, operation?: string) {
    this.initialize();

    return Sentry.startSpan(
      {
        name,
        op: operation || "custom",
      },
      (span) => {
        return span;
      },
    );
  }

  withErrorReporting<T extends (...args: any[]) => any>(fn: T, context?: ErrorContext): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);

        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.reportError(error, context);
            throw error;
          });
        }

        return result;
      } catch (error) {
        this.reportError(error as Error, context);
        throw error;
      }
    }) as T;
  }
}

// Create singleton instance
const errorReporter = new ErrorReporter();

// Export convenience functions
export const reportError = (error: Error | string, context?: ErrorContext) =>
  errorReporter.reportError(error, context);

export const reportMessage = (message: string, context?: ErrorContext) =>
  errorReporter.reportMessage(message, context);

export const setUser = (user: { id?: string; email?: string; tenantId?: string }) =>
  errorReporter.setUser(user);

export const setContext = (key: string, context: Record<string, any>) =>
  errorReporter.setContext(key, context);

export const addBreadcrumb = (message: string, category?: string, data?: Record<string, any>) =>
  errorReporter.addBreadcrumb(message, category, data);

export const recordPerformanceMetric = (metric: PerformanceMetric) =>
  errorReporter.recordPerformanceMetric(metric);

export const startTransaction = (name: string, operation?: string) =>
  errorReporter.startTransaction(name, operation);

export const withErrorReporting = <T extends (...args: any[]) => any>(
  fn: T,
  context?: ErrorContext,
) => errorReporter.withErrorReporting(fn, context);

export default errorReporter;
