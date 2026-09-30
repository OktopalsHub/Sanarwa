import { ApiError } from "./client";

export interface ErrorHandlerConfig {
  showToast?: boolean;
  logError?: boolean;
  redirectOnAuth?: boolean;
}

type ToastLike = { error: (message: string) => void };

/** Apps (e.g. web) can inject sonner/toast here — keeps api-client UI-free. */
let toastImpl: ToastLike = {
  error: (message) => {
    if (typeof console !== "undefined") console.error(message);
  },
};

export function setApiErrorToast(toast: ToastLike): void {
  toastImpl = toast;
}

const toast = {
  error: (message: string) => toastImpl.error(message),
};

export class ApiErrorHandler {
  private static defaultConfig: ErrorHandlerConfig = {
    showToast: true,
    logError: true,
    redirectOnAuth: true,
  };

  static handle(error: ApiError, config: ErrorHandlerConfig = {}): void {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (finalConfig.logError) {
      console.error("API Error:", {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details,
      });
    }

    // Handle specific error codes
    switch (error.code) {
      case "UNAUTHORIZED":
      case "TOKEN_EXPIRED":
        this.handleAuthError(error, finalConfig);
        break;
      case "FORBIDDEN":
      case "TENANT_ACCESS_DENIED":
        this.handlePermissionError(error, finalConfig);
        break;
      case "VALIDATION_ERROR":
        this.handleValidationError(error, finalConfig);
        break;
      case "RATE_LIMITED":
        this.handleRateLimitError(error, finalConfig);
        break;
      case "NO_TENANT_SELECTED":
        this.handleTenantError(error, finalConfig);
        break;
      case "NETWORK_ERROR":
        this.handleNetworkError(error, finalConfig);
        break;
      default:
        this.handleGenericError(error, finalConfig);
    }
  }

  private static handleAuthError(error: ApiError, config: ErrorHandlerConfig): void {
    if (config.showToast) {
      toast.error("Authentication required. Please log in again.");
    }

    if (config.redirectOnAuth && typeof window !== "undefined") {
      // Store current location for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== "/login") {
        localStorage.setItem("redirectAfterLogin", currentPath);
      }

      // Redirect to login
      window.location.href = "/login";
    }
  }

  private static handlePermissionError(error: ApiError, config: ErrorHandlerConfig): void {
    const message = error.message || "You do not have permission to perform this action";

    if (config.showToast) {
      toast.error(message);
    }
  }

  private static handleValidationError(error: ApiError, config: ErrorHandlerConfig): void {
    if (config.showToast) {
      if (error.details && Array.isArray(error.details)) {
        // Show field-specific validation errors
        error.details.forEach((validationError: any) => {
          const fieldMessage = validationError.field
            ? `${validationError.field}: ${validationError.message}`
            : validationError.message;
          toast.error(fieldMessage);
        });
      } else {
        toast.error(error.message || "Validation failed. Please check your input.");
      }
    }
  }

  private static handleRateLimitError(error: ApiError, config: ErrorHandlerConfig): void {
    if (config.showToast) {
      toast.error("Too many requests. Please try again later.");
    }
  }

  private static handleTenantError(error: ApiError, config: ErrorHandlerConfig): void {
    if (config.showToast) {
      toast.error("Please select a tenant to continue.");
    }
  }

  private static handleNetworkError(error: ApiError, config: ErrorHandlerConfig): void {
    if (config.showToast) {
      toast.error("Network error. Please check your connection and try again.");
    }
  }

  private static handleGenericError(error: ApiError, config: ErrorHandlerConfig): void {
    const message = error.message || "An unexpected error occurred. Please try again.";

    if (config.showToast) {
      toast.error(message);
    }
  }

  // Utility method to check if error should trigger retry
  static shouldRetry(error: ApiError): boolean {
    // Don't retry client errors (4xx) except for specific cases
    if (error.status && error.status >= 400 && error.status < 500) {
      // Retry on 408 (timeout), 429 (rate limit), and network errors
      return error.status === 408 || error.status === 429 || error.code === "NETWORK_ERROR";
    }

    // Retry on server errors (5xx) and network errors
    return !error.status || error.status >= 500 || error.code === "NETWORK_ERROR";
  }

  // Utility method to get retry delay based on attempt count
  static getRetryDelay(attemptCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attemptCount) * 1000;
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }
}

// React hook for error handling
export const useApiErrorHandler = (config?: ErrorHandlerConfig) => {
  return {
    handleError: (error: ApiError) => ApiErrorHandler.handle(error, config),
    shouldRetry: ApiErrorHandler.shouldRetry,
    getRetryDelay: ApiErrorHandler.getRetryDelay,
  };
};
