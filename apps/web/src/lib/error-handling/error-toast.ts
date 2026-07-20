import type { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/utils/toast';

export interface ErrorToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  persistent?: boolean;
}

/**
 * Enhanced error toast system with different error types and actions
 */
export class ErrorToast {
  private static instance: ErrorToast;
  private activeToasts = new Set<string>();

  private constructor() { }

  static getInstance(): ErrorToast {
    if (!ErrorToast.instance) {
      ErrorToast.instance = new ErrorToast();
    }
    return ErrorToast.instance;
  }

  /**
   * Show a generic error toast
   */
  showError(message: string, options: ErrorToastOptions = {}): string {
    const toastId = this.generateToastId();

    toast.error(message, {
      id: toastId,
      description: options.description,
      duration: options.duration || 5000,
      action: options.action,
      dismissible: options.dismissible !== false,
      onDismiss: () => this.activeToasts.delete(toastId),
      onAutoClose: () => this.activeToasts.delete(toastId),
    });

    this.activeToasts.add(toastId);
    return toastId;
  }

  /**
   * Show authentication error toast with login action
   */
  showAuthError(message?: string, options: ErrorToastOptions = {}): string {
    return this.showError(
      message || 'Authentication required. Please log in again.',
      {
        ...options,
        action: options.action || {
          label: 'Login',
          onClick: () => {
            window.location.href = '/login';
          }
        },
        duration: 8000, // Longer duration for auth errors
      }
    );
  }

  /**
   * Show network error toast with retry action
   */
  showNetworkError(message?: string, retryFn?: () => void, options: ErrorToastOptions = {}): string {
    return this.showError(
      message || 'Network error. Please check your connection.',
      {
        ...options,
        action: retryFn ? {
          label: 'Retry',
          onClick: retryFn
        } : options.action,
        duration: 6000,
      }
    );
  }

  /**
   * Show validation error toast
   */
  showValidationError(message: string, options: ErrorToastOptions = {}): string {
    return this.showError(message, {
      ...options,
      duration: 4000, // Shorter duration for validation errors
    });
  }

  /**
   * Show permission error toast
   */
  showPermissionError(message?: string, options: ErrorToastOptions = {}): string {
    return this.showError(
      message || 'You do not have permission to perform this action.',
      {
        ...options,
        duration: 5000,
      }
    );
  }

  /**
   * Show rate limit error toast
   */
  showRateLimitError(message?: string, retryAfter?: number, options: ErrorToastOptions = {}): string {
    const retryMessage = retryAfter
      ? `Please wait ${retryAfter} seconds before trying again.`
      : 'Please wait a moment before trying again.';

    return this.showError(
      message || 'Too many requests.',
      {
        ...options,
        description: options.description || retryMessage,
        duration: 8000,
      }
    );
  }

  /**
   * Show server error toast with support contact
   */
  showServerError(message?: string, errorId?: string, options: ErrorToastOptions = {}): string {
    const description = errorId
      ? `Error ID: ${errorId}. Our team has been notified.`
      : 'Our team has been notified and is working on a fix.';

    return this.showError(
      message || 'Server error. Please try again later.',
      {
        ...options,
        description: options.description || description,
        action: options.action || {
          label: 'Contact Support',
          onClick: () => {
            const supportUrl = errorId
              ? `mailto:support@notifi.com?subject=Server Error - ${errorId}&body=Error ID: ${errorId}`
              : 'mailto:support@notifi.com?subject=Server Error';
            window.open(supportUrl, '_blank');
          }
        },
        duration: 10000, // Longer duration for server errors
      }
    );
  }

  /**
   * Show API error toast based on error type
   */
  showApiError(error: ApiError, retryFn?: () => void, options: ErrorToastOptions = {}): string {
    // Handle specific error types
    if (error.status === 401) {
      return this.showAuthError(error.message, options);
    }

    if (error.status === 403) {
      return this.showPermissionError(error.message, options);
    }

    if (error.status === 429) {
      return this.showRateLimitError(error.message, undefined, options);
    }

    if (error.status && error.status >= 500) {
      return this.showServerError(error.message, undefined, options);
    }

    if (error.code === 'NETWORK_ERROR' || this.isNetworkError(error)) {
      return this.showNetworkError(error.message, retryFn, options);
    }

    if (error.status === 422) {
      return this.showValidationError(error.message, options);
    }

    // Default error toast
    return this.showError(error.message, {
      ...options,
      action: retryFn ? {
        label: 'Retry',
        onClick: retryFn
      } : options.action,
    });
  }

  /**
   * Show success toast (for positive feedback after error recovery)
   */
  showSuccess(message: string, options: Omit<ErrorToastOptions, 'action'> = {}): string {
    const toastId = this.generateToastId();

    toast.success(message, {
      id: toastId,
      description: options.description,
      duration: options.duration || 3000,
      dismissible: options.dismissible !== false,
      onDismiss: () => this.activeToasts.delete(toastId),
      onAutoClose: () => this.activeToasts.delete(toastId),
    });

    this.activeToasts.add(toastId);
    return toastId;
  }

  /**
   * Show warning toast
   */
  showWarning(message: string, options: ErrorToastOptions = {}): string {
    const toastId = this.generateToastId();

    toast.warning(message, {
      id: toastId,
      description: options.description,
      duration: options.duration || 4000,
      action: options.action,
      dismissible: options.dismissible !== false,
      onDismiss: () => this.activeToasts.delete(toastId),
      onAutoClose: () => this.activeToasts.delete(toastId),
    });

    this.activeToasts.add(toastId);
    return toastId;
  }

  /**
   * Show info toast
   */
  showInfo(message: string, options: ErrorToastOptions = {}): string {
    const toastId = this.generateToastId();

    toast.info(message, {
      id: toastId,
      description: options.description,
      duration: options.duration || 3000,
      action: options.action,
      dismissible: options.dismissible !== false,
      onDismiss: () => this.activeToasts.delete(toastId),
      onAutoClose: () => this.activeToasts.delete(toastId),
    });

    this.activeToasts.add(toastId);
    return toastId;
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(toastId: string): void {
    toast.dismiss(toastId);
    this.activeToasts.delete(toastId);
  }

  /**
   * Dismiss all active toasts
   */
  dismissAll(): void {
    toast.dismiss();
    this.activeToasts.clear();
  }

  /**
   * Get active toast count
   */
  getActiveToastCount(): number {
    return this.activeToasts.size;
  }

  /**
   * Check if a specific toast is active
   */
  isToastActive(toastId: string): boolean {
    return this.activeToasts.has(toastId);
  }

  private generateToastId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isNetworkError(error: ApiError): boolean {
    return error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network error') ||
      error.message?.includes('fetch') ||
      error.message?.includes('NetworkError');
  }
}

// Export singleton instance
export const errorToast = ErrorToast.getInstance();

// Convenience functions
export const showErrorToast = (message: string, options?: ErrorToastOptions) =>
  errorToast.showError(message, options);

export const showAuthErrorToast = (message?: string, options?: ErrorToastOptions) =>
  errorToast.showAuthError(message, options);

export const showNetworkErrorToast = (message?: string, retryFn?: () => void, options?: ErrorToastOptions) =>
  errorToast.showNetworkError(message, retryFn, options);

export const showValidationErrorToast = (message: string, options?: ErrorToastOptions) =>
  errorToast.showValidationError(message, options);

export const showPermissionErrorToast = (message?: string, options?: ErrorToastOptions) =>
  errorToast.showPermissionError(message, options);

export const showRateLimitErrorToast = (message?: string, retryAfter?: number, options?: ErrorToastOptions) =>
  errorToast.showRateLimitError(message, retryAfter, options);

export const showServerErrorToast = (message?: string, errorId?: string, options?: ErrorToastOptions) =>
  errorToast.showServerError(message, errorId, options);

export const showApiErrorToast = (error: ApiError, retryFn?: () => void, options?: ErrorToastOptions) =>
  errorToast.showApiError(error, retryFn, options);

export const showSuccessToast = (message: string, options?: Omit<ErrorToastOptions, 'action'>) =>
  errorToast.showSuccess(message, options);

export const showWarningToast = (message: string, options?: ErrorToastOptions) =>
  errorToast.showWarning(message, options);

export const showInfoToast = (message: string, options?: ErrorToastOptions) =>
  errorToast.showInfo(message, options);