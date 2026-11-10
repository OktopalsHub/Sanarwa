import type { ApiError } from "@sanarwa/api-client";

export interface ErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (error: ApiError) => void;
}

export function handleApiError(error: unknown, options: ErrorHandlerOptions = {}) {
  console.error("Query error:", error, options);
  throw error;
}

function getErrorMessage(error: ApiError): string {
  switch (error.code) {
    case "NO_TENANT_SELECTED":
      return "Please select a tenant to continue";
    case "TENANT_ACCESS_DENIED":
      return "You do not have access to this tenant";
    case "TENANT_NOT_FOUND":
      return "Tenant not found";
    case "INVALID_CREDENTIALS":
      return "Invalid email or password";
    case "EMAIL_ALREADY_EXISTS":
      return "An account with this email already exists";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email address";
    case "INVALID_TOKEN":
      return "Invalid or expired token";
    case "RATE_LIMITED":
      return "Too many requests. Please try again later";
    default:
      break;
  }

  switch (error.status) {
    case 400:
      return error.message || "Invalid request";
    case 401:
      return "Authentication required. Please log in";
    case 403:
      return "You do not have permission to perform this action";
    case 404:
      return "The requested resource was not found";
    case 409:
      return error.message || "Conflict with existing data";
    case 422:
      return error.message || "Validation error";
    case 429:
      return "Too many requests. Please try again later";
    case 500:
      return "Server error. Please try again later";
    case 502:
    case 503:
    case 504:
      return "Service temporarily unavailable. Please try again later";
    default:
      return error.message || "An unexpected error occurred";
  }
}

export const queryErrorHandler = (error: unknown) => {
  return handleApiError(error, {
    showToast: false,
  });
};

export const mutationErrorHandler = (error: unknown, customMessage?: string) => {
  return handleApiError(error, {
    showToast: true,
    customMessage,
  });
};

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Failed to fetch")
    );
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as ApiError).status === 401;
  }
  return false;
}

export function isPermissionError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as ApiError).status === 403;
  }
  return false;
}

export function isValidationError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as ApiError).status === 422;
  }
  return false;
}

export function getValidationErrors(error: unknown): Record<string, string[]> | null {
  if (isValidationError(error)) {
    const apiError = error as ApiError;
    if (apiError.details && typeof apiError.details === "object") {
      return apiError.details as Record<string, string[]>;
    }
  }
  return null;
}
