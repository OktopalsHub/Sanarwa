/**
 * Performance optimization utilities for the Notifi platform
 * Includes lazy loading, code splitting, and performance monitoring
 */

import { ComponentType, lazy } from "react";

// Lazy loading utilities
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType,
) {
  const LazyComponent = lazy(importFn);

  if (fallback) {
    return {
      Component: LazyComponent,
      Fallback: fallback,
    };
  }

  return LazyComponent;
}

// Dynamic import with retry logic
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await importFn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error("Dynamic import failed after retries");
}

// Image lazy loading utilities
export function createImageLoader(src: string, quality: number = 75) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=3840&q=${quality}`;
}

export function getOptimizedImageProps(src: string, alt: string, width?: number, height?: number) {
  return {
    src,
    alt,
    width,
    height,
    loading: "lazy" as const,
    decoding: "async" as const,
    style: { maxWidth: "100%", height: "auto" },
  };
}

// Performance monitoring
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
        console.log(`Performance: ${name} took ${measure.duration.toFixed(2)}ms`);
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

// Bundle size optimization utilities
export function preloadRoute(href: string) {
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  }
}

export function preloadComponent(importFn: () => Promise<any>) {
  if (typeof window !== "undefined") {
    // Preload on idle
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 1);
    }
  }
}

// Memory optimization utilities
export class MemoryManager {
  private static cache: Map<string, any> = new Map();
  private static maxCacheSize = 100;

  static set(key: string, value: any) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  static get(key: string) {
    return this.cache.get(key);
  }

  static clear() {
    this.cache.clear();
  }

  static getSize() {
    return this.cache.size;
  }
}

// Debounce and throttle utilities for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Virtual scrolling utilities
export function calculateVisibleItems(
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  overscan: number = 5,
) {
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    totalItems - 1,
  );

  return {
    start: Math.max(0, visibleStart - overscan),
    end: Math.min(totalItems - 1, visibleEnd + overscan),
    visibleStart,
    visibleEnd,
  };
}

// Resource hints utilities
export function addResourceHints() {
  if (typeof window !== "undefined") {
    // DNS prefetch for external domains
    const dnsPrefetchDomains = ["fonts.googleapis.com", "fonts.gstatic.com"];

    dnsPrefetchDomains.forEach((domain) => {
      const link = document.createElement("link");
      link.rel = "dns-prefetch";
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Preconnect to critical domains
    const preconnectDomains = ["https://fonts.googleapis.com"];

    preconnectDomains.forEach((domain) => {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = domain;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }
}

// Critical CSS utilities
export function loadNonCriticalCSS(href: string) {
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.media = "print";
    link.onload = () => {
      link.media = "all";
    };
    document.head.appendChild(link);
  }
}

// Service Worker utilities
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

// Web Vitals reporting
export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === "production") {
    // Send to analytics service
    console.log("Web Vital:", metric);

    // Example: Send to Google Analytics
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
