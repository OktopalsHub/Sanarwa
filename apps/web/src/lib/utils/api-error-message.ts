import type { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/utils/toast";

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ApiError).message === "string"
  );
}

/** Turn API / network failures into a user-readable sentence. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiError(error)) {
    if (error.message?.trim()) return error.message;
    if (error.status === 401) return "Invalid email or password";
    if (error.status === 403) return "You do not have permission to do that";
    if (error.status === 404) return "That resource was not found";
    if (error.status === 409) return "That name or URL is already taken";
    if (error.status === 429) return "Too many attempts. Wait a moment and try again";
    if (error.status && error.status >= 500) return "Server error. Try again in a moment";
    if (error.code === "NETWORK_ERROR") return "Network error. Check your connection.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function toastApiError(error: unknown, fallback?: string): string {
  const message = getApiErrorMessage(error, fallback);
  toast.error(message);
  return message;
}
