interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

interface NavigationTiming {
  dns: number;
  tcp: number;
  request: number;
  response: number;
  dom: number;
  load: number;
  total: number;
}

interface ResourceTiming {
  name: string;
  type: string;
  duration: number;
  size?: number;
  transferSize?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isEnabled: boolean = true;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Only initialize in production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring() {
    // Start periodic flushing
    this.startPeriodicFlush();

    // Monitor page load performance
    this.monitorPageLoad();

    // Monitor Core Web Vitals
    this.monitorCoreWebVitals();

    // Monitor resource loading
    this.monitorResourceLoading();

    // Monitor user interactions
    this.monitorUserInteractions();

    // Monitor API calls
    this.monitorApiCalls();
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private monitorPageLoad() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            const timing = this.calculateNavigationTiming(navigation);
            this.recordMetric('page_load_time', timing.total);
            this.recordMetric('dns_lookup_time', timing.dns);
            this.recordMetric('tcp_connection_time', timing.tcp);
            this.recordMetric('request_time', timing.request);
            this.recordMetric('response_time', timing.response);
            this.recordMetric('dom_processing_time', timing.dom);
          }
        }, 0);
      });
    }
  }

  private calculateNavigationTiming(navigation: PerformanceNavigationTiming): NavigationTiming {
    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      load: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.fetchStart,
    };
  }

  private monitorCoreWebVitals() {
    // First Contentful Paint (FCP)
    this.observePerformanceEntry('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.recordMetric('first_contentful_paint', entry.startTime);
      }
    });

    // Largest Contentful Paint (LCP)
    this.observePerformanceEntry('largest-contentful-paint', (entry) => {
      this.recordMetric('largest_contentful_paint', entry.startTime);
    });

    // First Input Delay (FID)
    this.observePerformanceEntry('first-input', (entry) => {
      this.recordMetric('first_input_delay', (entry as any).processingStart - entry.startTime);
    });

    // Cumulative Layout Shift (CLS)
    this.observePerformanceEntry('layout-shift', (entry) => {
      if (!(entry as any).hadRecentInput) {
        this.recordMetric('cumulative_layout_shift', (entry as any).value);
      }
    });
  }

  private observePerformanceEntry(type: string, callback: (entry: PerformanceEntry) => void) {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(callback);
        });
        observer.observe({ type, buffered: true });
      } catch (error) {
        console.warn(`Failed to observe ${type} performance entries:`, error);
      }
    }
  }

  private monitorResourceLoading() {
    this.observePerformanceEntry('resource', (entry) => {
      const resource = entry as PerformanceResourceTiming;
      const resourceData: ResourceTiming = {
        name: resource.name,
        type: this.getResourceType(resource.name),
        duration: resource.duration,
        size: resource.decodedBodySize,
        transferSize: resource.transferSize,
      };

      this.recordMetric('resource_load_time', resource.duration, {
        resource: resourceData,
      });

      // Track slow resources
      if (resource.duration > 1000) {
        this.recordMetric('slow_resource', resource.duration, {
          resource: resourceData,
        });
      }
    });
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private monitorUserInteractions() {
    // Monitor click interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const elementInfo = this.getElementInfo(target);

      this.recordMetric('user_click', Date.now(), {
        element: elementInfo,
        coordinates: { x: event.clientX, y: event.clientY },
      });
    });

    // Monitor form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.recordMetric('form_submission', Date.now(), {
        formId: form.id,
        formAction: form.action,
        formMethod: form.method,
      });
    });

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.recordMetric('page_visibility_change', Date.now(), {
        hidden: document.hidden,
      });
    });
  }

  private getElementInfo(element: HTMLElement) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 50),
    };
  }

  private monitorApiCalls() {
    // Intercept fetch calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : args[0].toString();

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetric('api_call', duration, {
          url,
          method: args[1]?.method || 'GET',
          status: response.status,
          success: response.ok,
        });

        // Track slow API calls
        if (duration > 2000) {
          this.recordMetric('slow_api_call', duration, {
            url,
            method: args[1]?.method || 'GET',
            status: response.status,
          });
        }

        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetric('api_error', duration, {
          url,
          method: args[1]?.method || 'GET',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    };
  }

  public recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (!this.isEnabled || process.env.NODE_ENV === 'development') return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userId: this.getUserId() || undefined,
      tenantId: this.getTenantId() || undefined,
      metadata,
    };

    this.metrics.push(metric);

    // Auto-flush if batch size is reached
    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  public recordCustomTiming(name: string, startTime: number, endTime?: number) {
    const end = endTime || performance.now();
    const duration = end - startTime;
    this.recordMetric(name, duration);
  }

  public startTiming(name: string): () => void {
    const startTime = performance.now();
    return () => {
      this.recordCustomTiming(name, startTime);
    };
  }

  private getUserId(): string | null {
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  private getTenantId(): string | null {
    try {
      const tenantData = localStorage.getItem('selectedTenant');
      if (tenantData) {
        const parsed = JSON.parse(tenantData);
        return parsed.id || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  private async flush() {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToSend,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      // Silently fail in development, only log in production
      if (process.env.NODE_ENV === 'production') {
        console.warn('Failed to send performance metrics:', error);
      }
      // Re-add metrics to queue for retry
      this.metrics.unshift(...metricsToSend);
    }
  }

  public enable() {
    this.isEnabled = true;
  }

  public disable() {
    this.isEnabled = false;
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Final flush
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for manual timing
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
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

export function withPerformanceTracking<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: any[]) => {
    return measurePerformance(name, () => fn(...args));
  }) as T;
}