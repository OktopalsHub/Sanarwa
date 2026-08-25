"use client";

import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { reportError, setContext, setUser } from "@/lib/monitoring/error-reporter";
import { monitoringService } from "@/lib/services/monitoring";
import React, { useEffect } from "react";

interface MonitoringProviderProps {
  children: React.ReactNode;
}

export default function MonitoringProvider({ children }: MonitoringProviderProps) {
  // Disable all monitoring in development
  if (process.env.NODE_ENV === "development") {
    return <>{children}</>;
  }

  const { user } = useAuth();
  const { selectedTenant } = useTenant();

  useEffect(() => {
    // Initialize monitoring service
    monitoringService.initialize();

    // Set up global error handling
    const handleUnhandledError = (event: ErrorEvent) => {
      reportError(event.error || new Error(event.message), {
        context: "unhandled_error",
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      reportError(error, {
        context: "unhandled_promise_rejection",
      });
    };

    // Add global error listeners
    window.addEventListener("error", handleUnhandledError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleUnhandledError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      monitoringService.destroy();
    };
  }, []);

  // Update user context when user changes
  useEffect(() => {
    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        tenantId: selectedTenant?.id,
      });

      setContext("user", {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
      });
    }
  }, [user, selectedTenant]);

  // Update tenant context when tenant changes
  useEffect(() => {
    if (selectedTenant) {
      setContext("tenant", {
        id: selectedTenant.id,
        name: selectedTenant.name,
        slug: selectedTenant.slug,
        subscription: selectedTenant.subscription,
      });
    }
  }, [selectedTenant]);

  // Track application lifecycle events
  useEffect(() => {
    const trackAppStart = () => {
      monitoringService.trackEvent("app_start", {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      });
    };

    const trackAppVisibilityChange = () => {
      monitoringService.trackEvent("app_visibility_change", {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      });
    };

    const trackAppBeforeUnload = () => {
      monitoringService.trackEvent("app_unload", {
        timestamp: Date.now(),
      });
    };

    // Track app start
    trackAppStart();

    // Add lifecycle event listeners
    document.addEventListener("visibilitychange", trackAppVisibilityChange);
    window.addEventListener("beforeunload", trackAppBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", trackAppVisibilityChange);
      window.removeEventListener("beforeunload", trackAppBeforeUnload);
    };
  }, []);

  return <>{children}</>;
}
