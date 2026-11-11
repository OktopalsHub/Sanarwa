import { alertManager } from "./alert-manager";
import { analyticsTracker } from "./analytics-tracker";
import { performanceMonitor } from "./performance-monitor";

interface MonitoringConfig {
  enablePerformanceMonitoring: boolean;
  enableAnalytics: boolean;
  enableAlerting: boolean;
  enableErrorReporting: boolean;
  apiEndpoint?: string;
  batchSize?: number;
  flushInterval?: number;
}

export class MonitoringService {
  private config: MonitoringConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    const isDevelopment = process.env.NODE_ENV === "development";

    this.config = {
      enablePerformanceMonitoring: !isDevelopment,
      enableAnalytics: !isDevelopment,
      enableAlerting: !isDevelopment,
      enableErrorReporting: !isDevelopment,
      apiEndpoint: "/api/monitoring",
      batchSize: 20,
      flushInterval: 30000,
      ...config,
    };
  }

  public initialize() {
    if (this.isInitialized) {
      console.warn("Monitoring service is already initialized");
      return;
    }

    if (typeof window === "undefined") {
      console.warn("Monitoring service can only be initialized in browser environment");
      return;
    }

    try {
      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.enable();
        if (process.env.NODE_ENV !== "development") {
          console.log("Performance monitoring enabled");
        }
      }

      if (this.config.enableAnalytics) {
        analyticsTracker.enable();
        if (process.env.NODE_ENV !== "development") {
          console.log("Analytics tracking enabled");
        }
      }

      if (this.config.enableAlerting) {
        alertManager.enable();
        if (process.env.NODE_ENV !== "development") {
          console.log("Alert manager enabled");
        }
      }

      if (this.config.enableErrorReporting) {
        this.setupGlobalErrorHandling();
        if (process.env.NODE_ENV !== "development") {
          console.log("Global error handling enabled");
        }
      }

      if (this.config.enableAlerting) {
        this.requestNotificationPermission();
      }

      this.isInitialized = true;
      if (process.env.NODE_ENV !== "development") {
        console.log("Monitoring service initialized successfully");
      }
    } catch (error) {
      console.error("Failed to initialize monitoring service:", error);
    }
  }

  private setupGlobalErrorHandling() {
    window.addEventListener("error", (event) => {
      const error = event.error || new Error(event.message);
      this.reportError(error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: "javascript_error",
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.reportError(error, {
        type: "unhandled_promise_rejection",
      });
    });

    if (process.env.NODE_ENV === "production") {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        originalConsoleError.apply(console, args);

        if (args.length > 0 && (args[0] instanceof Error || typeof args[0] === "string")) {
          this.reportError(args[0] instanceof Error ? args[0] : new Error(String(args[0])), {
            type: "console_error",
            args: args.slice(1),
          });
        }
      };
    }
  }

  private async requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn("Failed to request notification permission:", error);
      }
    }
  }

  public reportError(error: Error, context?: Record<string, any>) {
    if (!this.config.enableErrorReporting) return;

    try {
      if (this.config.enableAnalytics) {
        analyticsTracker.trackError(error, context);
      }

      if (this.config.enableAlerting) {
        const isCritical = this.isCriticalError(error, context);
        if (isCritical) {
          alertManager.createCustomAlert("error", "critical", `Critical error: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            context,
          });
        }
      }
    } catch (monitoringError) {
      console.error("Failed to report error to monitoring service:", monitoringError);
    }
  }

  private isCriticalError(error: Error, context?: Record<string, any>): boolean {
    if (context?.severity === "critical") {
      return true;
    }

    const criticalPatterns = [
      /network error/i,
      /authentication failed/i,
      /permission denied/i,
      /server error/i,
      /database error/i,
      /payment failed/i,
    ];

    const errorMessage = error.message.toLowerCase();
    return criticalPatterns.some((pattern) => pattern.test(errorMessage));
  }

  public trackEvent(name: string, properties?: Record<string, any>) {
    if (this.config.enableAnalytics) {
      analyticsTracker.trackEvent(name, properties);
    }
  }

  public trackPerformance(name: string, value: number, context?: Record<string, any>) {
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.recordMetric(name, value, context);
    }

    const threshold = context?.threshold;
    if (this.config.enableAlerting && typeof threshold === "number" && value > threshold) {
      alertManager.createCustomAlert(
        "performance",
        "high",
        `Performance threshold exceeded for ${name}: ${value} exceeds ${threshold}`,
        { name, value, threshold, ...context },
      );
    }
  }

  public measurePerformance<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.config.enablePerformanceMonitoring) {
      return fn();
    }

    const endTiming = performanceMonitor.startTiming(name);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.finally(() => {
          endTiming();
        });
      } else {
        endTiming();
        return result;
      }
    } catch (error) {
      endTiming();
      throw error;
    }
  }

  public createAlert(
    type:
      | "error"
      | "performance"
      | "security"
      | "availability"
      | "user_experience"
      | "business_metric",
    severity: "low" | "medium" | "high" | "critical",
    message: string,
    context?: Record<string, any>,
  ) {
    if (this.config.enableAlerting) {
      alertManager.createCustomAlert(type, severity, message, context);
    }
  }

  public getHealthStatus() {
    return {
      initialized: this.isInitialized,
      performanceMonitoring: this.config.enablePerformanceMonitoring,
      analytics: this.config.enableAnalytics,
      alerting: this.config.enableAlerting,
      errorReporting: this.config.enableErrorReporting,
      timestamp: Date.now(),
    };
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>) {
    this.config = { ...this.config, ...newConfig };

    if (this.isInitialized) {
      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.enable();
      } else {
        performanceMonitor.disable();
      }

      if (this.config.enableAnalytics) {
        analyticsTracker.enable();
      } else {
        analyticsTracker.disable();
      }

      if (this.config.enableAlerting) {
        alertManager.enable();
      } else {
        alertManager.disable();
      }
    }
  }

  public destroy() {
    if (!this.isInitialized) return;

    try {
      performanceMonitor.destroy();
      analyticsTracker.destroy();

      this.isInitialized = false;
      console.log("Monitoring service destroyed");
    } catch (error) {
      console.error("Error destroying monitoring service:", error);
    }
  }
}

export const monitoringService = new MonitoringService();

function withMonitoring<T extends (...args: any[]) => any>(name: string, fn: T): T {
  return ((...args: any[]) => {
    return monitoringService.measurePerformance(name, () => fn(...args));
  }) as T;
}

function trackUserAction(action: string, context?: Record<string, any>) {
  monitoringService.trackEvent("user_action", {
    action,
    ...context,
  });
}

function trackFeatureUsage(feature: string, action: string, context?: Record<string, any>) {
  monitoringService.trackEvent("feature_usage", {
    feature,
    action,
    ...context,
  });
}

function reportCriticalError(error: Error, context?: Record<string, any>) {
  monitoringService.reportError(error, context);
  monitoringService.createAlert("error", "critical", `Critical error: ${error.message}`, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
}
