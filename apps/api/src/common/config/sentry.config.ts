import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { httpIntegration } from "@sentry/node";
import { consoleIntegration } from "@sentry/node";
import { onUncaughtExceptionIntegration } from "@sentry/node";
import { onUnhandledRejectionIntegration } from "@sentry/node";

export function initializeSentry(dsn: string, environment: string) {
  Sentry.init({
    dsn,
    environment,
    integrations: [
      nodeProfilingIntegration(),
      httpIntegration(),
      consoleIntegration(),
      onUncaughtExceptionIntegration(),
      onUnhandledRejectionIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    profilesSampleRate: environment === "production" ? 0.1 : 1.0,

    // Error filtering
    beforeSend(event, hint) {
      // Filter out common non-errors
      if (event.exception) {
        const error = hint.originalException as Error;
        if (error?.message?.includes("ECONNRESET")) {
          return null; // Ignore connection resets
        }
        if (error?.message?.includes("Client disconnected")) {
          return null; // Ignore client disconnects
        }
      }
      return event;
    },

    // User context
    beforeSendTransaction(event) {
      // Add custom transaction context
      return event;
    },
  });

  // Global error handler
  process.on("uncaughtException", (error) => {
    Sentry.captureException(error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    Sentry.captureException(reason as Error, {
      tags: { type: "unhandledRejection" },
      extra: { promise: promise.toString() },
    });
  });
}

export function setSentryUser(user: { id: string; email?: string; tenantId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    tenant_id: user.tenantId,
  });
}

export function setSentryContext(key: string, context: any) {
  Sentry.setContext(key, context);
}

export function captureSentryException(error: Error, context?: any) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
}

export function captureSentryMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: any,
) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureMessage(message, level);
  });
}
