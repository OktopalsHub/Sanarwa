interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  tenantId?: string;
  url: string;
  userAgent: string;
}

interface UserSession {
  id: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  events: number;
}

interface PageView {
  url: string;
  title: string;
  referrer: string;
  timestamp: number;
  duration?: number;
}

class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private session: UserSession;
  private currentPageView: PageView | null = null;
  private isEnabled: boolean = true;
  private batchSize: number = 20;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Only initialize in production
    if (process.env.NODE_ENV === 'production') {
      this.session = this.initializeSession();

      if (typeof window !== 'undefined') {
        this.initializeTracking();
      }
    } else {
      // Minimal session for development
      this.session = {
        id: 'dev-session',
        startTime: Date.now(),
        lastActivity: Date.now(),
        pageViews: 0,
        events: 0,
      };
    }
  }

  private initializeSession(): UserSession {
    const existingSession = this.getStoredSession();
    const now = Date.now();

    if (existingSession && (now - existingSession.lastActivity) < this.sessionTimeout) {
      // Continue existing session
      return {
        ...existingSession,
        lastActivity: now,
      };
    } else {
      // Create new session
      const newSession: UserSession = {
        id: this.generateSessionId(),
        startTime: now,
        lastActivity: now,
        pageViews: 0,
        events: 0,
      };
      this.storeSession(newSession);
      return newSession;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStoredSession(): UserSession | null {
    try {
      const stored = localStorage.getItem('analytics_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private storeSession(session: UserSession) {
    try {
      localStorage.setItem('analytics_session', JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  }

  private initializeTracking() {
    // Track page views
    this.trackPageView();

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden');
        this.endCurrentPageView();
      } else {
        this.trackEvent('page_visible');
        this.trackPageView();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.endCurrentPageView();
      this.flush();
    });

    // Track user interactions
    this.trackUserInteractions();

    // Track form interactions
    this.trackFormInteractions();

    // Track scroll behavior
    this.trackScrollBehavior();

    // Start periodic flushing
    this.startPeriodicFlush();

    // Track session activity
    this.trackSessionActivity();
  }

  private trackPageView() {
    // End previous page view
    this.endCurrentPageView();

    // Start new page view
    this.currentPageView = {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
    };

    this.session.pageViews++;
    this.session.lastActivity = Date.now();
    this.storeSession(this.session);

    this.trackEvent('page_view', {
      url: this.currentPageView.url,
      title: this.currentPageView.title,
      referrer: this.currentPageView.referrer,
    });
  }

  private endCurrentPageView() {
    if (this.currentPageView) {
      const duration = Date.now() - this.currentPageView.timestamp;

      this.trackEvent('page_view_end', {
        url: this.currentPageView.url,
        title: this.currentPageView.title,
        duration,
      });

      this.currentPageView = null;
    }
  }

  private trackUserInteractions() {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const elementInfo = this.getElementInfo(target);

      this.trackEvent('click', {
        element: elementInfo,
        coordinates: { x: event.clientX, y: event.clientY },
      });
    });

    // Track keyboard interactions
    document.addEventListener('keydown', (event) => {
      // Only track specific keys to avoid privacy issues
      if (['Enter', 'Escape', 'Tab'].includes(event.key)) {
        this.trackEvent('key_press', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        });
      }
    });
  }

  private trackFormInteractions() {
    // Track form field focus
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        this.trackEvent('form_field_focus', {
          fieldType: target.tagName.toLowerCase(),
          fieldName: (target as HTMLInputElement).name,
          fieldId: target.id,
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.trackEvent('form_submit', {
        formId: form.id,
        formAction: form.action,
        formMethod: form.method,
      });
    });

    // Track form validation errors
    document.addEventListener('invalid', (event) => {
      const target = event.target as HTMLInputElement;
      this.trackEvent('form_validation_error', {
        fieldName: target.name,
        fieldId: target.id,
        validationMessage: target.validationMessage,
      });
    });
  }

  private trackScrollBehavior() {
    let scrollTimeout: NodeJS.Timeout;
    let maxScroll = 0;

    const trackScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackEvent('scroll_depth', {
          scrollPercent: maxScroll,
          url: window.location.href,
        });
      }, 1000);
    };

    window.addEventListener('scroll', trackScroll, { passive: true });
  }

  private trackSessionActivity() {
    // Track mouse movement to detect activity
    let activityTimeout: NodeJS.Timeout;

    const resetActivityTimer = () => {
      clearTimeout(activityTimeout);
      this.session.lastActivity = Date.now();
      this.storeSession(this.session);

      activityTimeout = setTimeout(() => {
        this.trackEvent('session_idle');
      }, 5 * 60 * 1000); // 5 minutes of inactivity
    };

    document.addEventListener('mousemove', resetActivityTimer, { passive: true });
    document.addEventListener('keydown', resetActivityTimer, { passive: true });
    document.addEventListener('click', resetActivityTimer, { passive: true });
    document.addEventListener('scroll', resetActivityTimer, { passive: true });

    resetActivityTimer();
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private getElementInfo(element: HTMLElement) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 50),
      href: (element as HTMLAnchorElement).href,
      type: (element as HTMLInputElement).type,
    };
  }

  public trackEvent(name: string, properties: Record<string, any> = {}) {
    if (!this.isEnabled || process.env.NODE_ENV === 'development') return;

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
      sessionId: this.session.id,
      userId: this.getUserId() || undefined,
      tenantId: this.getTenantId() || undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.events.push(event);
    this.session.events++;
    this.session.lastActivity = Date.now();
    this.storeSession(this.session);

    // Auto-flush if batch size is reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  public trackCustomEvent(name: string, properties: Record<string, any> = {}) {
    this.trackEvent(`custom_${name}`, properties);
  }

  public trackFeatureUsage(featureName: string, action: string, properties: Record<string, any> = {}) {
    this.trackEvent('feature_usage', {
      feature: featureName,
      action,
      ...properties,
    });
  }

  public trackError(error: Error, context?: Record<string, any>) {
    this.trackEvent('client_error', {
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  public trackPerformance(metricName: string, value: number, context?: Record<string, any>) {
    this.trackEvent('performance_metric', {
      metric: metricName,
      value,
      context,
    });
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
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      await fetch('/api/monitoring/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToSend,
          session: this.session,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      // Silently fail in development, only log in production
      if (process.env.NODE_ENV === 'production') {
        console.warn('Failed to send analytics events:', error);
      }
      // Re-add events to queue for retry
      this.events.unshift(...eventsToSend);
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
    this.endCurrentPageView();
    this.flush(); // Final flush
  }
}

// Singleton instance
export const analyticsTracker = new AnalyticsTracker();

// Utility functions for common tracking scenarios
export function trackButtonClick(buttonName: string, context?: Record<string, any>) {
  analyticsTracker.trackEvent('button_click', {
    buttonName,
    ...context,
  });
}

export function trackNavigation(from: string, to: string) {
  analyticsTracker.trackEvent('navigation', {
    from,
    to,
  });
}

export function trackSearch(query: string, results: number, context?: Record<string, any>) {
  analyticsTracker.trackEvent('search', {
    query,
    results,
    ...context,
  });
}

export function trackModalOpen(modalName: string, context?: Record<string, any>) {
  analyticsTracker.trackEvent('modal_open', {
    modalName,
    ...context,
  });
}

export function trackModalClose(modalName: string, context?: Record<string, any>) {
  analyticsTracker.trackEvent('modal_close', {
    modalName,
    ...context,
  });
}