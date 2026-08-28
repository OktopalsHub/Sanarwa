"use client";

import { PerformanceMonitor, reportWebVitals } from "@/lib/utils/performance";
import { useEffect } from "react";

interface PerformanceMonitorProps {
  enableWebVitals?: boolean;
  enableCustomMetrics?: boolean;
  reportingEndpoint?: string;
}

export function PerformanceMonitorComponent({
  enableWebVitals = true,
  enableCustomMetrics = true,
  reportingEndpoint,
}: PerformanceMonitorProps) {
  useEffect(() => {
    if (!enableWebVitals && !enableCustomMetrics) return;

    let cleanup: (() => void) | undefined;

    // Initialize performance monitoring
    if (enableWebVitals) {
      // Monitor Core Web Vitals
      PerformanceMonitor.observeLCP((entry) => {
        const metric = {
          name: "LCP",
          value: entry.startTime,
          id: `lcp-${Date.now()}`,
          entries: [entry],
        };
        reportWebVitals(metric);

        if (reportingEndpoint) {
          sendMetricToEndpoint(metric, reportingEndpoint);
        }
      });

      PerformanceMonitor.observeFID((entry) => {
        const fidEntry = entry as any; // Type assertion for FID entry
        const metric = {
          name: "FID",
          value: (fidEntry.processingStart || entry.startTime) - entry.startTime,
          id: `fid-${Date.now()}`,
          entries: [entry],
        };
        reportWebVitals(metric);

        if (reportingEndpoint) {
          sendMetricToEndpoint(metric, reportingEndpoint);
        }
      });

      PerformanceMonitor.observeCLS((entry) => {
        const clsEntry = entry as any; // Type assertion for CLS entry
        const metric = {
          name: "CLS",
          value: clsEntry.value || 0,
          id: `cls-${Date.now()}`,
          entries: [entry],
        };
        reportWebVitals(metric);

        if (reportingEndpoint) {
          sendMetricToEndpoint(metric, reportingEndpoint);
        }
      });
    }

    // Monitor custom metrics
    if (enableCustomMetrics) {
      // Monitor route changes
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        PerformanceMonitor.startMeasure("route-change");
        originalPushState.apply(history, args);

        // End measurement after a short delay to capture rendering
        setTimeout(() => {
          PerformanceMonitor.endMeasure("route-change");
        }, 100);
      };

      history.replaceState = function (...args) {
        PerformanceMonitor.startMeasure("route-change");
        originalReplaceState.apply(history, args);

        setTimeout(() => {
          PerformanceMonitor.endMeasure("route-change");
        }, 100);
      };

      // Monitor resource loading
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;

            // Report slow resources
            if (resourceEntry.duration > 1000) {
              console.warn("Slow resource detected:", {
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                size: resourceEntry.transferSize,
              });

              if (reportingEndpoint) {
                sendMetricToEndpoint(
                  {
                    name: "slow-resource",
                    value: resourceEntry.duration,
                    resource: resourceEntry.name,
                    size: resourceEntry.transferSize,
                  },
                  reportingEndpoint,
                );
              }
            }
          }
        });
      });

      observer.observe({ entryTypes: ["resource"] });

      // Cleanup function
      cleanup = () => {
        PerformanceMonitor.disconnect();
        observer.disconnect();
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    }

    return cleanup;
  }, [enableWebVitals, enableCustomMetrics, reportingEndpoint]);

  // This component doesn't render anything
  return null;
}

// Utility function to send metrics to reporting endpoint
async function sendMetricToEndpoint(metric: any, endpoint: string) {
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...metric,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    });
  } catch (error) {
    console.error("Failed to send metric to endpoint:", error);
  }
}

// Hook for measuring component performance
export function useComponentPerformance(componentName: string) {
  useEffect(() => {
    PerformanceMonitor.startMeasure(`component-${componentName}`);

    return () => {
      PerformanceMonitor.endMeasure(`component-${componentName}`);
    };
  }, [componentName]);
}

// Hook for measuring async operations
export function useAsyncPerformance() {
  const measureAsync = async function <T>(
    operationName: string,
    asyncOperation: () => Promise<T>,
  ): Promise<T> {
    PerformanceMonitor.startMeasure(operationName);

    try {
      const result = await asyncOperation();
      PerformanceMonitor.endMeasure(operationName);
      return result;
    } catch (error) {
      PerformanceMonitor.endMeasure(operationName);
      throw error;
    }
  };

  return { measureAsync };
}

// Component for displaying performance metrics (development only)
export function PerformanceDebugger() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const interval = setInterval(() => {
      const metrics = PerformanceMonitor.getAllMetrics();
      if (Object.keys(metrics).length > 0) {
        console.table(metrics);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-2 text-xs font-mono shadow-lg z-50">
      <div className="text-green-600">Performance Monitor Active</div>
      <div className="text-muted-foreground">Check console for metrics</div>
    </div>
  );
}
