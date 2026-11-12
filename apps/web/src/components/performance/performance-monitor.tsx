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

    if (enableWebVitals) {
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
        const fidEntry = entry as any;
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
        const clsEntry = entry as any;
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

    if (enableCustomMetrics) {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        PerformanceMonitor.startMeasure("route-change");
        originalPushState.apply(history, args);

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

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;

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

      cleanup = () => {
        PerformanceMonitor.disconnect();
        observer.disconnect();
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    }

    return cleanup;
  }, [enableWebVitals, enableCustomMetrics, reportingEndpoint]);

  return null;
}

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
