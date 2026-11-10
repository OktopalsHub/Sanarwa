"use client";

import { analyticsTracker } from "@/lib/services/analytics-tracker";
import { usePathname } from "@/compat/next-navigation";
import { useEffect, useRef } from "react";

interface UserBehaviorTrackerProps {
  children: React.ReactNode;
}

export default function UserBehaviorTracker({ children }: UserBehaviorTrackerProps) {
  if (process.env.NODE_ENV === "development") {
    return <>{children}</>;
  }

  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);
  const sessionStartTime = useRef<number>(Date.now());
  const pageStartTime = useRef<number>(Date.now());
  const interactionCount = useRef<number>(0);
  const scrollDepth = useRef<number>(0);

  useEffect(() => {
    if (previousPathname.current && previousPathname.current !== pathname) {
      analyticsTracker.trackEvent("page_navigation", {
        from: previousPathname.current,
        to: pathname,
        timeOnPreviousPage: Date.now() - pageStartTime.current,
        interactionsOnPreviousPage: interactionCount.current,
        maxScrollDepthOnPreviousPage: scrollDepth.current,
      });

      pageStartTime.current = Date.now();
      interactionCount.current = 0;
      scrollDepth.current = 0;
    }

    previousPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const trackInteraction = (event: Event) => {
      interactionCount.current++;

      const target = event.target as HTMLElement;
      const elementInfo = getElementInfo(target);

      analyticsTracker.trackEvent("user_interaction", {
        type: event.type,
        element: elementInfo,
        timestamp: Date.now(),
        sessionDuration: Date.now() - sessionStartTime.current,
        pageUrl: window.location.href,
      });

      if (event.type === "click") {
        trackClickBehavior(event as MouseEvent, elementInfo);
      }
    };

    const trackScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100,
      );

      if (scrollPercent > scrollDepth.current) {
        scrollDepth.current = scrollPercent;

        if (scrollPercent >= 25 && scrollDepth.current < 25) {
          analyticsTracker.trackEvent("scroll_milestone", { depth: 25 });
        } else if (scrollPercent >= 50 && scrollDepth.current < 50) {
          analyticsTracker.trackEvent("scroll_milestone", { depth: 50 });
        } else if (scrollPercent >= 75 && scrollDepth.current < 75) {
          analyticsTracker.trackEvent("scroll_milestone", { depth: 75 });
        } else if (scrollPercent >= 90 && scrollDepth.current < 90) {
          analyticsTracker.trackEvent("scroll_milestone", { depth: 90 });
        }
      }
    };

    const trackFormInteraction = (event: Event) => {
      const target = event.target as HTMLFormElement | HTMLInputElement;

      if (event.type === "submit") {
        const form = target as HTMLFormElement;
        analyticsTracker.trackEvent("form_submission", {
          formId: form.id,
          formAction: form.action,
          formMethod: form.method,
          fieldCount: form.elements.length,
        });
      } else if (event.type === "focus" || event.type === "blur") {
        const input = target as HTMLInputElement;
        if (
          input.tagName === "INPUT" ||
          input.tagName === "TEXTAREA" ||
          input.tagName === "SELECT"
        ) {
          analyticsTracker.trackEvent("form_field_interaction", {
            type: event.type,
            fieldName: input.name,
            fieldType: input.type,
            fieldId: input.id,
          });
        }
      }
    };

    const trackKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        analyticsTracker.trackEvent("keyboard_shortcut", {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        });
      }
    };

    const trackVisibilityChange = () => {
      analyticsTracker.trackEvent("page_visibility_change", {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      });
    };

    let idleTimer: NodeJS.Timeout;
    let isIdle = false;

    let idleStartTime = 0;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);

      if (isIdle) {
        isIdle = false;
        analyticsTracker.trackEvent("user_active", {
          idleDuration: Date.now() - idleStartTime,
        });
      }

      idleTimer = setTimeout(() => {
        isIdle = true;
        idleStartTime = Date.now();
        analyticsTracker.trackEvent("user_idle");
      }, 30000);
    };

    document.addEventListener("click", trackInteraction);
    document.addEventListener("keydown", trackInteraction);
    document.addEventListener("keydown", trackKeyboardShortcut);
    document.addEventListener("submit", trackFormInteraction);
    document.addEventListener("focus", trackFormInteraction, true);
    document.addEventListener("blur", trackFormInteraction, true);
    document.addEventListener("visibilitychange", trackVisibilityChange);
    window.addEventListener("scroll", trackScroll, { passive: true });

    document.addEventListener("mousemove", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("click", resetIdleTimer);
    document.addEventListener("scroll", resetIdleTimer);
    resetIdleTimer();

    analyticsTracker.trackEvent("session_start", {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    });

    return () => {
      document.removeEventListener("click", trackInteraction);
      document.removeEventListener("keydown", trackInteraction);
      document.removeEventListener("keydown", trackKeyboardShortcut);
      document.removeEventListener("submit", trackFormInteraction);
      document.removeEventListener("focus", trackFormInteraction, true);
      document.removeEventListener("blur", trackFormInteraction, true);
      document.removeEventListener("visibilitychange", trackVisibilityChange);
      window.removeEventListener("scroll", trackScroll);

      document.removeEventListener("mousemove", resetIdleTimer);
      document.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("click", resetIdleTimer);
      document.removeEventListener("scroll", resetIdleTimer);
      clearTimeout(idleTimer);

      analyticsTracker.trackEvent("session_end", {
        sessionDuration: Date.now() - sessionStartTime.current,
        totalInteractions: interactionCount.current,
        maxScrollDepth: scrollDepth.current,
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "performance" in window) {
      window.addEventListener("load", () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType(
            "navigation",
          )[0] as PerformanceNavigationTiming;
          if (navigation) {
            analyticsTracker.trackEvent("page_load_performance", {
              loadTime: navigation.loadEventEnd - navigation.startTime,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
              firstPaint: getFirstPaint(),
              firstContentfulPaint: getFirstContentfulPaint(),
            });
          }
        }, 0);
      });
    }
  }, []);

  return <>{children}</>;
}

function getElementInfo(element: HTMLElement | null | undefined) {
  if (!element?.tagName) {
    return {
      tagName: "unknown",
      id: "",
      className: "",
      textContent: undefined,
      href: undefined,
      type: undefined,
      name: undefined,
      role: null,
      ariaLabel: null,
    };
  }

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id,
    className: element.className,
    textContent: element.textContent?.substring(0, 100),
    href: (element as HTMLAnchorElement).href,
    type: (element as HTMLInputElement).type,
    name: (element as HTMLInputElement).name,
    role: element.getAttribute("role"),
    ariaLabel: element.getAttribute("aria-label"),
  };
}

function trackClickBehavior(event: MouseEvent, elementInfo: any) {
  const target = event.target as HTMLElement;

  if (target.tagName === "BUTTON" || target.getAttribute("role") === "button") {
    analyticsTracker.trackEvent("button_click", {
      buttonText: target.textContent?.trim(),
      buttonId: target.id,
      buttonClass: target.className,
    });
  }

  if (target.tagName === "A") {
    const link = target as HTMLAnchorElement;
    analyticsTracker.trackEvent("link_click", {
      href: link.href,
      linkText: link.textContent?.trim(),
      isExternal: link.hostname !== window.location.hostname,
      opensInNewTab: link.target === "_blank",
    });
  }

  if (target.closest("nav") || target.getAttribute("role") === "menuitem") {
    analyticsTracker.trackEvent("navigation_click", {
      navigationItem: target.textContent?.trim(),
      navigationSection: target.closest("nav")?.getAttribute("aria-label"),
    });
  }

  if (target.closest('[role="dialog"]') || target.closest(".modal")) {
    analyticsTracker.trackEvent("modal_interaction", {
      action: "click",
      modalId: target.closest('[role="dialog"]')?.id,
      elementClicked: elementInfo,
    });
  }

  const featureElement = target.closest("[data-feature]");
  if (featureElement) {
    const featureName = featureElement.getAttribute("data-feature");
    analyticsTracker.trackEvent("feature_usage", {
      feature: featureName,
      action: "click",
      element: elementInfo,
    });
  }
}

function getFirstPaint(): number | null {
  const paintEntries = performance.getEntriesByType("paint");
  const firstPaint = paintEntries.find((entry) => entry.name === "first-paint");
  return firstPaint ? firstPaint.startTime : null;
}

function getFirstContentfulPaint(): number | null {
  const paintEntries = performance.getEntriesByType("paint");
  const firstContentfulPaint = paintEntries.find(
    (entry) => entry.name === "first-contentful-paint",
  );
  return firstContentfulPaint ? firstContentfulPaint.startTime : null;
}
