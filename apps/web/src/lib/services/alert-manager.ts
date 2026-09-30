interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  context: Record<string, any>;
  userId?: string;
  tenantId?: string;
  url: string;
  userAgent: string;
  resolved?: boolean;
  resolvedAt?: number;
}

type AlertType =
  | "error"
  | "performance"
  | "security"
  | "availability"
  | "user_experience"
  | "business_metric";

type AlertSeverity = "low" | "medium" | "high" | "critical";

interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  condition: (data: any) => boolean;
  severity: AlertSeverity;
  cooldown: number; // milliseconds
  enabled: boolean;
}

interface AlertThresholds {
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  crashRate: number;
  userDropoff: number;
}

class AlertManager {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private thresholds: AlertThresholds;
  private isEnabled: boolean = true;

  constructor() {
    this.thresholds = {
      errorRate: 0.05, // 5% error rate
      responseTime: 3000, // 3 seconds
      memoryUsage: 0.8, // 80% memory usage
      crashRate: 0.01, // 1% crash rate
      userDropoff: 0.3, // 30% user dropoff
    };

    this.initializeDefaultRules();

    if (typeof window !== "undefined") {
      this.initializeMonitoring();
    }
  }

  private initializeDefaultRules() {
    this.rules = [
      {
        id: "high_error_rate",
        name: "High Error Rate",
        type: "error",
        condition: (data) => data.errorRate > this.thresholds.errorRate,
        severity: "high",
        cooldown: 5 * 60 * 1000, // 5 minutes
        enabled: true,
      },
      {
        id: "slow_response_time",
        name: "Slow Response Time",
        type: "performance",
        condition: (data) => data.responseTime > this.thresholds.responseTime,
        severity: "medium",
        cooldown: 2 * 60 * 1000, // 2 minutes
        enabled: true,
      },
      {
        id: "memory_leak",
        name: "High Memory Usage",
        type: "performance",
        condition: (data) => data.memoryUsage > this.thresholds.memoryUsage,
        severity: "high",
        cooldown: 10 * 60 * 1000, // 10 minutes
        enabled: true,
      },
      {
        id: "frequent_crashes",
        name: "Frequent Application Crashes",
        type: "availability",
        condition: (data) => data.crashRate > this.thresholds.crashRate,
        severity: "critical",
        cooldown: 1 * 60 * 1000, // 1 minute
        enabled: true,
      },
      {
        id: "user_dropoff",
        name: "High User Dropoff Rate",
        type: "user_experience",
        condition: (data) => data.dropoffRate > this.thresholds.userDropoff,
        severity: "medium",
        cooldown: 15 * 60 * 1000, // 15 minutes
        enabled: true,
      },
      {
        id: "security_violation",
        name: "Security Policy Violation",
        type: "security",
        condition: (data) => data.securityViolation === true,
        severity: "critical",
        cooldown: 0, // No cooldown for security issues
        enabled: true,
      },
    ];
  }

  private initializeMonitoring() {
    // Monitor JavaScript errors
    window.addEventListener("error", (event) => {
      this.checkErrorAlert(event.error);
    });

    // Monitor unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.checkErrorAlert(event.reason);
    });

    // Monitor performance issues
    this.monitorPerformance();

    // Monitor memory usage
    this.monitorMemoryUsage();

    // Monitor user behavior anomalies
    this.monitorUserBehavior();
  }

  private monitorPerformance() {
    // Monitor API response times
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();

      try {
        const response = await originalFetch(...args);
        const responseTime = performance.now() - startTime;

        this.checkPerformanceAlert({
          responseTime,
          url:
            typeof args[0] === "string"
              ? args[0]
              : args[0] instanceof Request
                ? args[0].url
                : args[0].toString(),
          status: response.status,
        });

        return response;
      } catch (error) {
        this.checkErrorAlert(error);
        throw error;
      }
    };
  }

  private monitorMemoryUsage() {
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          this.checkMemoryAlert({ memoryUsage });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private monitorUserBehavior() {
    let errorCount = 0;
    let totalInteractions = 0;

    // Track user interactions and errors
    document.addEventListener("click", () => {
      totalInteractions++;
    });

    window.addEventListener("error", () => {
      errorCount++;
      const errorRate = errorCount / Math.max(totalInteractions, 1);
      this.checkUserExperienceAlert({ errorRate });
    });

    // Reset counters periodically
    setInterval(
      () => {
        errorCount = 0;
        totalInteractions = 0;
      },
      5 * 60 * 1000,
    ); // Reset every 5 minutes
  }

  private checkErrorAlert(error: any) {
    const errorData = {
      errorRate: this.calculateErrorRate(),
      error: error instanceof Error ? error.message : String(error),
    };

    this.evaluateRules("error", errorData);
  }

  private checkPerformanceAlert(data: any) {
    this.evaluateRules("performance", data);
  }

  private checkMemoryAlert(data: any) {
    this.evaluateRules("performance", data);
  }

  private checkUserExperienceAlert(data: any) {
    this.evaluateRules("user_experience", data);
  }

  private calculateErrorRate(): number {
    // Simple error rate calculation based on recent errors
    const recentErrors = this.alerts.filter(
      (alert) => alert.type === "error" && Date.now() - alert.timestamp < 5 * 60 * 1000, // Last 5 minutes
    );

    return recentErrors.length / 100; // Simplified calculation
  }

  private evaluateRules(type: AlertType, data: any) {
    const relevantRules = this.rules.filter((rule) => rule.enabled && rule.type === type);

    for (const rule of relevantRules) {
      try {
        if (rule.condition(data)) {
          this.triggerAlert(rule, data);
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.id}:`, error);
      }
    }
  }

  private triggerAlert(rule: AlertRule, context: any) {
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;

    // Check cooldown period
    if (now - lastAlertTime < rule.cooldown) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      type: rule.type,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, context),
      timestamp: now,
      context,
      userId: this.getUserId() || undefined,
      tenantId: this.getTenantId() || undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.alerts.push(alert);
    this.lastAlertTimes.set(rule.id, now);

    // Send alert to monitoring service
    this.sendAlert(alert);

    // Show user notification for critical alerts
    if (alert.severity === "critical") {
      this.showCriticalAlertNotification(alert);
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertMessage(rule: AlertRule, context: any): string {
    switch (rule.id) {
      case "high_error_rate":
        return `High error rate detected: ${(context.errorRate * 100).toFixed(1)}%`;
      case "slow_response_time":
        return `Slow response time detected: ${context.responseTime.toFixed(0)}ms for ${context.url}`;
      case "memory_leak":
        return `High memory usage detected: ${(context.memoryUsage * 100).toFixed(1)}%`;
      case "frequent_crashes":
        return `Frequent crashes detected: ${(context.crashRate * 100).toFixed(1)}% crash rate`;
      case "user_dropoff":
        return `High user dropoff rate detected: ${(context.dropoffRate * 100).toFixed(1)}%`;
      case "security_violation":
        return `Security policy violation detected: ${context.violation}`;
      default:
        return `Alert triggered: ${rule.name}`;
    }
  }

  private async sendAlert(alert: Alert) {
    try {
      await fetch("/api/monitoring/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error("Failed to send alert:", error);
    }
  }

  private showCriticalAlertNotification(alert: Alert) {
    // Show a non-intrusive notification for critical alerts
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Critical Issue Detected", {
        body: alert.message,
        icon: "/favicon.ico",
        tag: alert.id,
      });
    }
  }

  public createCustomAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    context: Record<string, any> = {},
  ) {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      timestamp: Date.now(),
      context,
      userId: this.getUserId() || undefined,
      tenantId: this.getTenantId() || undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.alerts.push(alert);
    this.sendAlert(alert);

    if (severity === "critical") {
      this.showCriticalAlertNotification(alert);
    }
  }

  public addCustomRule(rule: AlertRule) {
    this.rules.push(rule);
  }

  public removeRule(ruleId: string) {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
  }

  public updateThresholds(newThresholds: Partial<AlertThresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  public getAlerts(type?: AlertType, severity?: AlertSeverity): Alert[] {
    return this.alerts.filter((alert) => {
      if (type && alert.type !== type) return false;
      if (severity && alert.severity !== severity) return false;
      return true;
    });
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  private getUserId(): string | null {
    try {
      const authData = localStorage.getItem("auth");
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
      const tenantData = localStorage.getItem("selectedTenant");
      if (tenantData) {
        const parsed = JSON.parse(tenantData);
        return parsed.id || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  public enable() {
    this.isEnabled = true;
  }

  public disable() {
    this.isEnabled = false;
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// Utility functions for common alert scenarios
export function alertCriticalError(error: Error, context?: Record<string, any>) {
  alertManager.createCustomAlert("error", "critical", `Critical error: ${error.message}`, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
}

export function alertPerformanceIssue(metric: string, value: number, threshold: number) {
  alertManager.createCustomAlert(
    "performance",
    "high",
    `Performance issue: ${metric} is ${value}, exceeding threshold of ${threshold}`,
    { metric, value, threshold },
  );
}

export function alertSecurityViolation(violation: string, context?: Record<string, any>) {
  alertManager.createCustomAlert("security", "critical", `Security violation: ${violation}`, {
    violation,
    ...context,
  });
}
