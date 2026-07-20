// Central monitoring service that coordinates all monitoring components
import { alertManager } from './alert-manager';
import { analyticsTracker } from './analytics-tracker';
import { performanceMonitor } from './performance-monitor';

interface MonitoringConfig {
  enablePerformanceMonitoring: boolean;
  enableAnalytics: boolean;
  enableAlerting: boolean;
  enableErrorReporting: boolean;
  apiEndpoint?: string;
  batchSize?: number;
  flushInterval?: number;
}

class MonitoringService {
  private config: MonitoringConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    // Disable monitoring in development by default
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    this.config = {
      enablePerformanceMonitoring: !isDevelopment,
      enableAnalytics: !isDevelopment,
      enableAlerting: !isDevelopment,
      enableErrorReporting: !isDevelopment,
      apiEndpoint: '/api/monitoring',
      batchSize: 20,
      flushInterval: 30000,
      ...config,
    };
  }

  public initialize() {
    if (this.isInitialized) {
      console.warn('Monitoring service is already initialized');
      return;
    }

    if (typeof window === 'undefined') {
      console.warn('Monitoring service can only be initialized in browser environment');
      return;
    }

    try {
      // Initialize performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.enable();
        if (process.env.NODE_ENV !== 'development') {
          console.log('Performance monitoring enabled');
        }
      }

      // Initialize analytics tracking
      if (this.config.enableAnalytics) {
        analyticsTracker.enable();
        if (process.env.NODE_ENV !== 'development') {
          console.log('Analytics tracking enabled');
        }
      }

      // Initialize alerting
      if (this.config.enableAlerting) {
        alertManager.enable();
        if (process.env.NODE_ENV !== 'development') {
          console.log('Alert manager enabled');
        }
      }

      // Set up global error handling
      if (this.config.enableErrorReporting) {
        this.setupGlobalErrorHandling();
        if (process.env.NODE_ENV !== 'development') {
          console.log('Global error handling enabled');
        }
      }

      // Request notification permission for critical alerts
      if (this.config.enableAlerting) {
        this.requestNotificationPermission();
      }

      this.isInitialized = true;
      if (process.env.NODE_ENV !== 'development') {
        console.log('Monitoring service initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error);
    }
  }

  private setupGlobalErrorHandling() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      const error = event.error || new Error(event.message);
      this.reportError(error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'javascript_error',
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.reportError(error, {
        type: 'unhandled_promise_rejection',
      });
    });

    // Only intercept console errors in production
    if (process.env.NODE_ENV === 'production') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        originalConsoleError.apply(console, args);

        // Only report if it looks like an actual error
        if (args.length > 0 && (args[0] instanceof Error || typeof args[0] === 'string')) {
          this.reportError(
            args[0] instanceof Error ? args[0] : new Error(String(args[0])),
            {
              type: 'console_error',
              args: args.slice(1),
            }
          );
        }
      };
    }
  }

  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }
    }
  }

  public reportError(error: Error, context?: Record<string, any>) {
    if (!this.config.enableErrorReporting) return;

    try {
      // Track error in analytics
      if (this.config.enableAnalytics) {
        analyticsTracker.trackError(error, context);
      }

      // Create alert for critical errors
      if (this.config.enableAlerting) {
        const isCritical = this.isCriticalError(error, context);
        if (isCritical) {
          alertManager.createCustomAlert(
            'error',
            'critical',
            `Critical error: ${error.message}`,
            {
              error: error.message,
              stack: error.stack,
              context,
            }
          );
        }
      }
    } catch (monitoringError) {
      console.error('Failed to report error to monitoring service:', monitoringError);
    }
  }

  private isCriticalError(error: Error, context?: Record<string, any>): boolean {
    // Define criteria for critical errors
    const criticalPatterns = [
      /network error/i,
      /authentication failed/i,
      /permission denied/i,
      /server error/i,
      /database error/i,
      /payment failed/i,
    ];

    const errorMessage = error.message.toLowerCase();
    return criticalPatterns.some(pattern => pattern.test(errorMessage));
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
    type: 'error' | 'performance' | 'security' | 'availability' | 'user_experience' | 'business_metric',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    context?: Record<string, any>
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

    // Apply config changes
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
      // alertManager doesn't need explicit cleanup

      this.isInitialized = false;
      console.log('Monitoring service destroyed');
    } catch (error) {
      console.error('Error destroying monitoring service:', error);
    }
  }
}

// Create singleton instance
export const monitoringService = new MonitoringService();

// Export individual services for direct access if needed
export { alertManager, analyticsTracker, performanceMonitor };

// Utility functions for common monitoring tasks
export function withMonitoring<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: any[]) => {
    return monitoringService.measurePerformance(name, () => fn(...args));
  }) as T;
}

export function trackUserAction(action: string, context?: Record<string, any>) {
  monitoringService.trackEvent('user_action', {
    action,
    ...context,
  });
}

export function trackFeatureUsage(feature: string, action: string, context?: Record<string, any>) {
  monitoringService.trackEvent('feature_usage', {
    feature,
    action,
    ...context,
  });
}

export function reportCriticalError(error: Error, context?: Record<string, any>) {
  monitoringService.reportError(error, context);
  monitoringService.createAlert(
    'error',
    'critical',
    `Critical error: ${error.message}`,
    { error: error.message, stack: error.stack, ...context }
  );
}