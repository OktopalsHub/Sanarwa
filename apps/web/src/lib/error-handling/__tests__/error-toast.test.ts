import type { ApiError } from '@/lib/api/client';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ErrorToast, type ErrorToastOptions } from '../error-toast';

// Mock toast utility
vi.mock('@/lib/utils/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('ErrorToast', () => {
  let errorToast: ErrorToast;
  let mockToast: {
    error: Mock;
    success: Mock;
    warning: Mock;
    info: Mock;
    dismiss: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    errorToast = ErrorToast.getInstance();
    mockToast = require('@/lib/utils/toast').toast;
  });

  describe('showError', () => {
    it('should show basic error toast', () => {
      const toastId = errorToast.showError('Test error');

      expect(mockToast.error).toHaveBeenCalledWith('Test error', expect.objectContaining({
        id: toastId,
        duration: 5000,
        dismissible: true,
      }));
      expect(errorToast.isToastActive(toastId)).toBe(true);
    });

    it('should show error toast with options', () => {
      const options: ErrorToastOptions = {
        description: 'Error description',
        duration: 3000,
        action: {
          label: 'Retry',
          onClick: vi.fn(),
        },
      };

      const toastId = errorToast.showError('Test error', options);

      expect(mockToast.error).toHaveBeenCalledWith('Test error', expect.objectContaining({
        id: toastId,
        description: 'Error description',
        duration: 3000,
        action: options.action,
      }));
    });
  });

  describe('showAuthError', () => {
    it('should show auth error with default message and login action', () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      const toastId = errorToast.showAuthError();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Authentication required. Please log in again.',
        expect.objectContaining({
          id: toastId,
          duration: 8000,
          action: expect.objectContaining({
            label: 'Login',
          }),
        })
      );
    });

    it('should show auth error with custom message', () => {
      const toastId = errorToast.showAuthError('Custom auth error');

      expect(mockToast.error).toHaveBeenCalledWith(
        'Custom auth error',
        expect.objectContaining({
          id: toastId,
          duration: 8000,
        })
      );
    });
  });

  describe('showNetworkError', () => {
    it('should show network error with default message', () => {
      const toastId = errorToast.showNetworkError();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Network error. Please check your connection.',
        expect.objectContaining({
          id: toastId,
          duration: 6000,
        })
      );
    });

    it('should show network error with retry action', () => {
      const retryFn = vi.fn();
      const toastId = errorToast.showNetworkError('Custom network error', retryFn);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Custom network error',
        expect.objectContaining({
          id: toastId,
          action: expect.objectContaining({
            label: 'Retry',
            onClick: retryFn,
          }),
        })
      );
    });
  });

  describe('showValidationError', () => {
    it('should show validation error with shorter duration', () => {
      const toastId = errorToast.showValidationError('Validation failed');

      expect(mockToast.error).toHaveBeenCalledWith(
        'Validation failed',
        expect.objectContaining({
          id: toastId,
          duration: 4000,
        })
      );
    });
  });

  describe('showPermissionError', () => {
    it('should show permission error with default message', () => {
      const toastId = errorToast.showPermissionError();

      expect(mockToast.error).toHaveBeenCalledWith(
        'You do not have permission to perform this action.',
        expect.objectContaining({
          id: toastId,
          duration: 5000,
        })
      );
    });
  });

  describe('showRateLimitError', () => {
    it('should show rate limit error with default message', () => {
      const toastId = errorToast.showRateLimitError();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Too many requests.',
        expect.objectContaining({
          id: toastId,
          duration: 8000,
          description: 'Please wait a moment before trying again.',
        })
      );
    });

    it('should show rate limit error with retry after time', () => {
      const toastId = errorToast.showRateLimitError('Rate limited', 30);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Rate limited',
        expect.objectContaining({
          id: toastId,
          description: 'Please wait 30 seconds before trying again.',
        })
      );
    });
  });

  describe('showServerError', () => {
    it('should show server error with default message', () => {
      const toastId = errorToast.showServerError();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Server error. Please try again later.',
        expect.objectContaining({
          id: toastId,
          duration: 10000,
          description: 'Our team has been notified and is working on a fix.',
        })
      );
    });

    it('should show server error with error ID and support action', () => {
      const toastId = errorToast.showServerError('Custom server error', 'error-123');

      expect(mockToast.error).toHaveBeenCalledWith(
        'Custom server error',
        expect.objectContaining({
          id: toastId,
          description: 'Error ID: error-123. Our team has been notified.',
          action: expect.objectContaining({
            label: 'Contact Support',
          }),
        })
      );
    });
  });

  describe('showApiError', () => {
    it('should show auth error for 401 status', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Unauthorized',
        status: 401,
        isAxiosError: true,
      };

      const toastId = errorToast.showApiError(apiError);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Unauthorized',
        expect.objectContaining({
          duration: 8000, // Auth error duration
        })
      );
    });

    it('should show permission error for 403 status', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Forbidden',
        status: 403,
        isAxiosError: true,
      };

      errorToast.showApiError(apiError);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Forbidden',
        expect.objectContaining({
          duration: 5000, // Permission error duration
        })
      );
    });

    it('should show rate limit error for 429 status', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Too many requests',
        status: 429,
        isAxiosError: true,
      };

      errorToast.showApiError(apiError);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Too many requests',
        expect.objectContaining({
          duration: 8000, // Rate limit error duration
        })
      );
    });

    it('should show server error for 5xx status', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Internal server error',
        status: 500,
        isAxiosError: true,
      };

      errorToast.showApiError(apiError);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Internal server error',
        expect.objectContaining({
          duration: 10000, // Server error duration
        })
      );
    });

    it('should show network error for network error code', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const retryFn = vi.fn();
      errorToast.showApiError(apiError, retryFn);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Network error',
        expect.objectContaining({
          duration: 6000, // Network error duration
          action: expect.objectContaining({
            label: 'Retry',
            onClick: retryFn,
          }),
        })
      );
    });

    it('should show validation error for 422 status', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Validation failed',
        status: 422,
        isAxiosError: true,
      };

      errorToast.showApiError(apiError);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Validation failed',
        expect.objectContaining({
          duration: 4000, // Validation error duration
        })
      );
    });

    it('should show default error for other cases', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Unknown error',
        status: 400,
        isAxiosError: true,
      };

      const retryFn = vi.fn();
      errorToast.showApiError(apiError, retryFn);

      expect(mockToast.error).toHaveBeenCalledWith(
        'Unknown error',
        expect.objectContaining({
          duration: 5000, // Default duration
          action: expect.objectContaining({
            label: 'Retry',
            onClick: retryFn,
          }),
        })
      );
    });
  });

  describe('showSuccess', () => {
    it('should show success toast', () => {
      const toastId = errorToast.showSuccess('Success message');

      expect(mockToast.success).toHaveBeenCalledWith(
        'Success message',
        expect.objectContaining({
          id: toastId,
          duration: 3000,
        })
      );
    });
  });

  describe('showWarning', () => {
    it('should show warning toast', () => {
      const toastId = errorToast.showWarning('Warning message');

      expect(mockToast.warning).toHaveBeenCalledWith(
        'Warning message',
        expect.objectContaining({
          id: toastId,
          duration: 4000,
        })
      );
    });
  });

  describe('showInfo', () => {
    it('should show info toast', () => {
      const toastId = errorToast.showInfo('Info message');

      expect(mockToast.info).toHaveBeenCalledWith(
        'Info message',
        expect.objectContaining({
          id: toastId,
          duration: 3000,
        })
      );
    });
  });

  describe('toast management', () => {
    it('should track active toasts', () => {
      const toastId1 = errorToast.showError('Error 1');
      const toastId2 = errorToast.showError('Error 2');

      expect(errorToast.getActiveToastCount()).toBe(2);
      expect(errorToast.isToastActive(toastId1)).toBe(true);
      expect(errorToast.isToastActive(toastId2)).toBe(true);
    });

    it('should dismiss specific toast', () => {
      const toastId = errorToast.showError('Test error');

      errorToast.dismiss(toastId);

      expect(mockToast.dismiss).toHaveBeenCalledWith(toastId);
      expect(errorToast.isToastActive(toastId)).toBe(false);
    });

    it('should dismiss all toasts', () => {
      errorToast.showError('Error 1');
      errorToast.showError('Error 2');

      errorToast.dismissAll();

      expect(mockToast.dismiss).toHaveBeenCalledWith();
      expect(errorToast.getActiveToastCount()).toBe(0);
    });
  });
});