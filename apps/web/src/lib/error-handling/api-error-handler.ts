import type { ApiError } from '@/lib/api/client';
import { addBreadcrumb, reportError, setContext } from '@/lib/monitoring/error-reporter';
import { toast } from '@/lib/utils/toast';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (error: ApiError) => void;
  context?: string;
  silent?: boolean;
  retryable?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ErrorMetadata {
  timestamp: Date;
  url: string;
  userAgent: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  component?: string;
}

/**
 * Centralized API error handler for consistent error processing across the application
 */
export class ApiErrorHandler {
  private static instance: ApiErrorHandler;
  private errorHistory: Array<{ error: ApiError; metadata: ErrorMetadata }> = [];
  private maxHistorySize = 50;

  private constructor() { }

  static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /**
   * Main error handling method
   */
  handle(error: unknown, options: ErrorHandlerOptions = {}): ApiError {
    const {
      showToast = true,
      customMessage,
      onError,
      context,
      silent = false,
      retryable = false
    } = options;

    const apiError = this.normalizeError(error);
    const metadata = this.collectErrorMetadata(context);

    // Add to error history
    this.addToHistory(apiError, metadata);

    // Add breadcrumb for debugging
    addBreadcrumb(
      `API Error: ${apiError.message}`,
      'error',
      {
        status: apiError.status,
        code: apiError.code,
        context,
        retryable
      }
    );

    // Set error context for monitoring
    setContext('error', {
      message: apiError.message,
      status: apiError.status,
      code: apiError.code,
      metadata,
      retryable
    });

    // Report to monitoring service
    if (!silent) {
      reportError(apiError, {
        context: context || 'ApiErrorHandler',
        extra: {
          metadata,
          retryable,
          originalError: error
        },
        level: this.getErrorLevel(apiError)
      });
    }

    // Show user-friendly toast notification
    if (showToast && !silent) {
      const message = customMessage || this.getUserFriendlyMessage(apiError);
      this.showErrorToast(apiError, message, retryable);
    }

    // Call custom error handler
    if (onError) {
      try {
        onError(apiError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    return apiError;
  }

  /**
   * Handle authentication errors specifically
   */
  handleAuthError(error: unknown, options: ErrorHandlerOptions = {}): ApiError {
    const apiError = this.handle(error, {
      ...options,
      context: 'Authentication',
      customMessage: options.customMessage || 'Authentication failed. Please log in again.'
    });

    // Redirect to login if needed
    if (this.isAuthError(apiError) && typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000); // Give time for toast to show
    }

    return apiError;
  }

  /**
   * Handle validation errors with field-specific messages
   */
  handleValidationError(error: unknown, options: ErrorHandlerOptions = {}): ValidationError[] {
    const apiError = this.handle(error, {
      ...options,
      showToast: false, // We'll show field-specific toasts
      context: 'Validation'
    });

    const validationErrors = this.extractValidationErrors(apiError);

    // Show field-specific error toasts
    if (options.showToast !== false) {
      validationErrors.forEach(validationError => {
        toast.error(`${validationError.field}: ${validationError.message}`);
      });
    }

    return validationErrors;
  }

  /**
   * Handle network errors with retry suggestions
   */
  handleNetworkError(error: unknown, options: ErrorHandlerOptions = {}): ApiError {
    return this.handle(error, {
      ...options,
      context: 'Network',
      retryable: true,
      customMessage: options.customMessage || 'Network error. Please check your connection and try again.'
    });
  }

  /**
   * Handle permission errors
   */
  handlePermissionError(error: unknown, options: ErrorHandlerOptions = {}): ApiError {
    return this.handle(error, {
      ...options,
      context: 'Permission',
      customMessage: options.customMessage || 'You do not have permission to perform this action.'
    });
  }

  /**
   * Handle rate limiting errors
   */
  handleRateLimitError(error: unknown, options: ErrorHandlerOptions = {}): ApiError {
    return this.handle(error, {
      ...options,
      context: 'RateLimit',
      customMessage: options.customMessage || 'Too many requests. Please wait a moment and try again.'
    });
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): Array<{ error: ApiError; metadata: ErrorMetadata }> {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: ApiError): boolean {
    // Network errors are retryable
    if (this.isNetworkError(error)) {
      return true;
    }

    // 5xx server errors are retryable
    if (error.status && error.status >= 500) {
      return true;
    }

    // Rate limit errors are retryable after delay
    if (error.status === 429) {
      return true;
    }

    // Timeout errors are retryable
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * Get retry delay for retryable errors
   */
  getRetryDelay(error: ApiError, attempt: number): number {
    if (error.status === 429) {
      // Rate limit: exponential backoff starting at 1 second
      return Math.min(1000 * Math.pow(2, attempt), 30000);
    }

    if (error.status && error.status >= 500) {
      // Server errors: exponential backoff starting at 500ms
      return Math.min(500 * Math.pow(2, attempt), 10000);
    }

    // Default exponential backoff
    return Math.min(1000 * Math.pow(2, attempt), 15000);
  }

  private normalizeError(error: unknown): ApiError {
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      return error as ApiError;
    }

    if (error instanceof Error) {
      const apiError = error as ApiError;
      apiError.isAxiosError = false;
      return apiError;
    }

    if (typeof error === 'string') {
      const apiError = new Error(error) as ApiError;
      apiError.code = 'UNKNOWN_ERROR';
      return apiError;
    }

    const apiError = new Error('An unexpected error occurred') as ApiError;
    apiError.code = 'UNKNOWN_ERROR';
    return apiError;
  }

  private collectErrorMetadata(context?: string): ErrorMetadata {
    const metadata: ErrorMetadata = {
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      component: context
    };

    // Try to get user and tenant info from storage
    if (typeof window !== 'undefined') {
      try {
        const authData = localStorage.getItem('auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          metadata.userId = parsed.user?.id;
        }

        const tenantData = localStorage.getItem('selectedTenant');
        if (tenantData) {
          const parsed = JSON.parse(tenantData);
          metadata.tenantId = parsed.id;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return metadata;
  }

  private addToHistory(error: ApiError, metadata: ErrorMetadata): void {
    this.errorHistory.unshift({ error, metadata });

    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  private getUserFriendlyMessage(error: ApiError): string {
    // Handle specific error codes
    switch (error.code) {
      case 'NO_TENANT_SELECTED':
        return 'Please select a tenant to continue';
      case 'TENANT_ACCESS_DENIED':
        return 'You do not have access to this tenant';
      case 'TENANT_NOT_FOUND':
        return 'Tenant not found';
      case 'INVALID_CREDENTIALS':
        return 'Invalid email or password';
      case 'EMAIL_ALREADY_EXISTS':
        return 'An account with this email already exists';
      case 'EMAIL_NOT_VERIFIED':
        return 'Please verify your email address';
      case 'INVALID_TOKEN':
        return 'Invalid or expired token';
      case 'RATE_LIMITED':
        return 'Too many requests. Please try again later';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection';
      default:
        break;
    }

    // Handle HTTP status codes
    switch (error.status) {
      case 400:
        return error.message || 'Invalid request';
      case 401:
        return 'Authentication required. Please log in';
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'The requested resource was not found';
      case 409:
        return error.message || 'Conflict with existing data';
      case 422:
        return error.message || 'Please check your input and try again';
      case 429:
        return 'Too many requests. Please try again later';
      case 500:
        return 'Server error. Please try again later';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }

  private showErrorToast(error: ApiError, message: string, retryable: boolean): void {
    if (retryable) {
      toast.error(message, {
        description: 'This error can be retried',
        action: {
          label: 'Retry',
          onClick: () => {
            // Emit retry event that components can listen to
            window.dispatchEvent(new CustomEvent('error-retry', { detail: { error } }));
          }
        }
      });
    } else {
      toast.error(message);
    }
  }

  private getErrorLevel(error: ApiError): 'error' | 'warning' | 'info' | 'debug' {
    if (error.status && error.status >= 500) {
      return 'error';
    }

    if (error.status === 429 || this.isNetworkError(error)) {
      return 'warning';
    }

    if (error.status === 401 || error.status === 403) {
      return 'info';
    }

    return 'error';
  }

  private extractValidationErrors(error: ApiError): ValidationError[] {
    if (error.details && typeof error.details === 'object') {
      const validationErrors: ValidationError[] = [];

      for (const [field, messages] of Object.entries(error.details)) {
        if (Array.isArray(messages)) {
          messages.forEach(message => {
            validationErrors.push({
              field,
              message,
              code: 'VALIDATION_ERROR'
            });
          });
        } else if (typeof messages === 'string') {
          validationErrors.push({
            field,
            message: messages,
            code: 'VALIDATION_ERROR'
          });
        }
      }

      return validationErrors;
    }

    return [];
  }

  private isAuthError(error: ApiError): boolean {
    return error.status === 401;
  }

  private isNetworkError(error: ApiError): boolean {
    return error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network error') ||
      error.message?.includes('fetch') ||
      error.message?.includes('NetworkError');
  }
}

// Export singleton instance
export const apiErrorHandler = ApiErrorHandler.getInstance();

// Convenience functions
export const handleApiError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handle(error, options);

export const handleAuthError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handleAuthError(error, options);

export const handleValidationError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handleValidationError(error, options);

export const handleNetworkError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handleNetworkError(error, options);

export const handlePermissionError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handlePermissionError(error, options);

export const handleRateLimitError = (error: unknown, options?: ErrorHandlerOptions) =>
  apiErrorHandler.handleRateLimitError(error, options);