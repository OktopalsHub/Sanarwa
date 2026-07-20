import type { ApiError } from '@/lib/api/client';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ApiErrorHandler } from '../api-error-handler';

// Mock dependencies
vi.mock('@/lib/utils/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/monitoring/error-reporter', () => ({
  reportError: vi.fn(),
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test',
  },
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
  },
});

describe('ApiErrorHandler', () => {
  let errorHandler: ApiErrorHandler;
  let mockToast: { error: Mock };
  let mockReportError: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler = ApiErrorHandler.getInstance();
    errorHandler.clearErrorHistory();

    mockToast = require('@/lib/utils/toast').toast;
    mockReportError = require('@/lib/monitoring/error-reporter').reportError;
  });

  describe('handle', () => {
    it('should handle API errors correctly', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        isAxiosError: true,
      };

      const result = errorHandler.handle(apiError);

      expect(result).toEqual(apiError);
      expect(mockToast.error).toHaveBeenCalledWith('Test error');
      expect(mockReportError).toHaveBeenCalled();
    });

    it('should handle string errors', () => {
      const result = errorHandler.handle('String error');

      expect(result.message).toBe('String error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(mockToast.error).toHaveBeenCalledWith('String error');
    });

    it('should handle unknown errors', () => {
      const result = errorHandler.handle({ unknown: 'object' });

      expect(result.message).toBe('An unexpected error occurred');
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should not show toast when showToast is false', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        isAxiosError: true,
      };

      errorHandler.handle(apiError, { showToast: false });

      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it('should use custom message when provided', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Original error',
        status: 400,
        code: 'TEST_ERROR',
        isAxiosError: true,
      };

      errorHandler.handle(apiError, { customMessage: 'Custom error message' });

      expect(mockToast.error).toHaveBeenCalledWith('Custom error message');
    });

    it('should call custom error handler', () => {
      const onError = vi.fn();
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        isAxiosError: true,
      };

      errorHandler.handle(apiError, { onError });

      expect(onError).toHaveBeenCalledWith(apiError);
    });

    it('should add error to history', () => {
      const apiError: ApiError = {
        name: 'ApiError',
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
        isAxiosError: true,
      };

      errorHandler.handle(apiError);

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.error).toEqual(apiError);
    });
  });

  describe('handleAuthError', () => {
    it('should handle authentication errors', () => {
      const authError: ApiError = {
        name: 'ApiError',
        message: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        isAxiosError: true,
      };

      const result = errorHandler.handleAuthError(authError);

      expect(result).toEqual(authError);
      expect(mockToast.error).toHaveBeenCalledWith('Authentication failed. Please log in again.');
    });

    it('should redirect to login for auth errors', async () => {
      const authError: ApiError = {
        name: 'ApiError',
        message: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        isAxiosError: true,
      };

      // Mock window.location.href setter
      let redirectUrl = '';
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url;
        },
        get: () => redirectUrl,
      });

      errorHandler.handleAuthError(authError);

      // Wait for redirect timeout
      await new Promise(resolve => setTimeout(resolve, 2100));
      expect(redirectUrl).toBe('/login');
    });
  });

  describe('handleValidationError', () => {
    it('should extract validation errors', () => {
      const validationError: ApiError = {
        name: 'ApiError',
        message: 'Validation failed',
        status: 422,
        code: 'VALIDATION_ERROR',
        details: {
          email: ['Email is required', 'Email must be valid'],
          password: 'Password is too short',
        },
        isAxiosError: true,
      };

      const result = errorHandler.handleValidationError(validationError);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        field: 'email',
        message: 'Email is required',
        code: 'VALIDATION_ERROR',
      });
      expect(result[1]).toEqual({
        field: 'email',
        message: 'Email must be valid',
        code: 'VALIDATION_ERROR',
      });
      expect(result[2]).toEqual({
        field: 'password',
        message: 'Password is too short',
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const serverError: ApiError = {
        name: 'ServerError',
        message: 'Internal server error',
        status: 500,
        isAxiosError: true,
      };

      const rateLimitError: ApiError = {
        name: 'RateLimitError',
        message: 'Too many requests',
        status: 429,
        isAxiosError: true,
      };

      expect(errorHandler.isRetryable(networkError)).toBe(true);
      expect(errorHandler.isRetryable(serverError)).toBe(true);
      expect(errorHandler.isRetryable(rateLimitError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError: ApiError = {
        name: 'ValidationError',
        message: 'Validation failed',
        status: 422,
        isAxiosError: true,
      };

      const authError: ApiError = {
        name: 'AuthError',
        message: 'Unauthorized',
        status: 401,
        isAxiosError: true,
      };

      expect(errorHandler.isRetryable(validationError)).toBe(false);
      expect(errorHandler.isRetryable(authError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate correct retry delays', () => {
      const rateLimitError: ApiError = {
        name: 'RateLimitError',
        message: 'Too many requests',
        status: 429,
        isAxiosError: true,
      };

      const serverError: ApiError = {
        name: 'ServerError',
        message: 'Internal server error',
        status: 500,
        isAxiosError: true,
      };

      // Rate limit errors: exponential backoff starting at 1 second
      expect(errorHandler.getRetryDelay(rateLimitError, 0)).toBe(1000);
      expect(errorHandler.getRetryDelay(rateLimitError, 1)).toBe(2000);
      expect(errorHandler.getRetryDelay(rateLimitError, 2)).toBe(4000);

      // Server errors: exponential backoff starting at 500ms
      expect(errorHandler.getRetryDelay(serverError, 0)).toBe(500);
      expect(errorHandler.getRetryDelay(serverError, 1)).toBe(1000);
      expect(errorHandler.getRetryDelay(serverError, 2)).toBe(2000);
    });

    it('should cap retry delays at maximum values', () => {
      const rateLimitError: ApiError = {
        name: 'RateLimitError',
        message: 'Too many requests',
        status: 429,
        isAxiosError: true,
      };

      // Should cap at 30 seconds for rate limit errors
      expect(errorHandler.getRetryDelay(rateLimitError, 10)).toBe(30000);
    });
  });

  describe('error history', () => {
    it('should maintain error history', () => {
      const error1: ApiError = {
        name: 'Error1',
        message: 'First error',
        status: 400,
        isAxiosError: true,
      };

      const error2: ApiError = {
        name: 'Error2',
        message: 'Second error',
        status: 500,
        isAxiosError: true,
      };

      errorHandler.handle(error1);
      errorHandler.handle(error2);

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0]?.error).toEqual(error2); // Most recent first
      expect(history[1]?.error).toEqual(error1);
    });

    it('should limit history size', () => {
      // Add more errors than the max history size (50)
      for (let i = 0; i < 60; i++) {
        const error: ApiError = {
          name: `Error${i}`,
          message: `Error ${i}`,
          status: 400,
          isAxiosError: true,
        };
        errorHandler.handle(error, { showToast: false, silent: true });
      }

      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(50);
    });

    it('should clear error history', () => {
      const error: ApiError = {
        name: 'Error',
        message: 'Test error',
        status: 400,
        isAxiosError: true,
      };

      errorHandler.handle(error);
      expect(errorHandler.getErrorHistory()).toHaveLength(1);

      errorHandler.clearErrorHistory();
      expect(errorHandler.getErrorHistory()).toHaveLength(0);
    });
  });

  describe('user-friendly messages', () => {
    it('should return appropriate messages for specific error codes', () => {
      const testCases = [
        {
          error: { code: 'NO_TENANT_SELECTED', message: 'No tenant' } as ApiError,
          expected: 'Please select a tenant to continue',
        },
        {
          error: { code: 'INVALID_CREDENTIALS', message: 'Bad creds' } as ApiError,
          expected: 'Invalid email or password',
        },
        {
          error: { code: 'RATE_LIMITED', message: 'Rate limited' } as ApiError,
          expected: 'Too many requests. Please try again later',
        },
      ];

      testCases.forEach(({ error, expected }) => {
        errorHandler.handle(error);
        expect(mockToast.error).toHaveBeenCalledWith(expected);
        vi.clearAllMocks();
      });
    });

    it('should return appropriate messages for HTTP status codes', () => {
      const testCases = [
        {
          error: { status: 401, message: 'Unauthorized' } as ApiError,
          expected: 'Authentication required. Please log in',
        },
        {
          error: { status: 403, message: 'Forbidden' } as ApiError,
          expected: 'You do not have permission to perform this action',
        },
        {
          error: { status: 404, message: 'Not found' } as ApiError,
          expected: 'The requested resource was not found',
        },
        {
          error: { status: 500, message: 'Server error' } as ApiError,
          expected: 'Server error. Please try again later',
        },
      ];

      testCases.forEach(({ error, expected }) => {
        errorHandler.handle(error);
        expect(mockToast.error).toHaveBeenCalledWith(expected);
        vi.clearAllMocks();
      });
    });
  });
});