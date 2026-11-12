export class PerformanceMonitor {
  private static metrics: Map<string, number> = new Map();
  private static observers: Map<string, PerformanceObserver> = new Map();

  static startMeasure(name: string) {
    if (typeof window !== "undefined" && "performance" in window) {
      performance.mark(`${name}-start`);
    }
  }

  static endMeasure(name: string) {
    if (typeof window !== "undefined" && "performance" in window) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);

      const measure = performance.getEntriesByName(name, "measure")[0];
      if (measure) {
        this.metrics.set(name, measure.duration);
      }
    }
  }

  static getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  static getAllMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  static observeLCP(callback: (entry: PerformanceEntry) => void) {
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) callback(lastEntry);
      });

      observer.observe({ type: "largest-contentful-paint", buffered: true });
      this.observers.set("lcp", observer);
    }
  }

  static observeFID(callback: (entry: PerformanceEntry) => void) {
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });

      observer.observe({ type: "first-input", buffered: true });
      this.observers.set("fid", observer);
    }
  }

  static observeCLS(callback: (entry: PerformanceEntry) => void) {
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });

      observer.observe({ type: "layout-shift", buffered: true });
      this.observers.set("cls", observer);
    }
  }

  static disconnect() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}

export function registerServiceWorker(swPath: string = "/sw.js") {
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    process.env.NODE_ENV === "production"
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(swPath)
        .then((registration) => {
          console.log("SW registered: ", registration);
        })
        .catch((registrationError) => {
          console.log("SW registration failed: ", registrationError);
        });
    });
  }
}

export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === "production") {
    console.log("Web Vital:", metric);

    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", metric.name, {
        event_category: "Web Vitals",
        event_label: metric.id,
        value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        non_interaction: true,
      });
    }
  }
}
