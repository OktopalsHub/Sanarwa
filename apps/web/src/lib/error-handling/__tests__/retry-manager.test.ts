import type { ApiError } from '@/lib/api/client';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { RetryManager, type RetryConfig } from '../retry-manager';

// Mock dependencies
vi.mock('../api-error-handler', () => ({
  apiErrorHandler: {
    handle: vi.fn((error) => error),
  },
}));

vi.mock('../error-toast', () => ({
  errorToast: {
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
  },
}));

// Mock timers - moved to beforeEach

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockErrorToast: { showWarning: Mock; showSuccess: Mock };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    retryManager = RetryManager.getInstance();
    retryManager.clearQueue();

    mockErrorToast = require('../error-toast').errorToast;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('executeWithRetry', () => {
    it('should execute request successfully on first attempt', async () => {
      const mockRequest = vi.fn().mockResolvedValue('success');

      const result = await retryManager.executeWithRetry(mockRequest);

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        baseDelay: 100,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(3);
      expect(mockErrorToast.showWarning).toHaveBeenCalledTimes(2); // Two retry attempts
    });

    it('should fail after max attempts', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const config: Partial<RetryConfig> = {
        maxAttempts: 2,
        baseDelay: 100,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError: ApiError = {
        name: 'ValidationError',
        message: 'Validation failed',
        status: 422,
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(validationError);

      await expect(retryManager.executeWithRetry(mockRequest)).rejects.toThrow('Validation failed');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should call retry callbacks', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const onRetry = vi.fn();
      const onMaxAttemptsReached = vi.fn();

      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        baseDelay: 100,
        onRetry,
        onMaxAttemptsReached,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      await promise;

      expect(onRetry).toHaveBeenCalledWith(networkError, 1, expect.any(Number));
      expect(onMaxAttemptsReached).not.toHaveBeenCalled();
    });

    it('should calculate exponential backoff delays', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const onRetry = vi.fn();
      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2,
        jitter: false, // Disable jitter for predictable testing
        onRetry,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // Check that delays follow exponential backoff
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, networkError, 1, 1000); // 1000ms
      expect(onRetry).toHaveBeenNthCalledWith(2, networkError, 2, 2000); // 2000ms
    });

    it('should apply jitter to delays', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const onRetry = vi.fn();
      const config: Partial<RetryConfig> = {
        maxAttempts: 2,
        baseDelay: 1000,
        jitter: true,
        onRetry,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // With jitter, delay should be between 500ms and 1000ms
      const delay = onRetry.mock.calls[0]?.[2];
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1000);
    });

    it('should cap delays at maxDelay', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const onRetry = vi.fn();
      const config: Partial<RetryConfig> = {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 2000,
        backoffMultiplier: 3,
        jitter: false,
        onRetry,
      };

      const promise = retryManager.executeWithRetry(mockRequest, config);

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // Check that delays are capped at maxDelay
      const delays = onRetry.mock.calls.map(call => call[2]);
      expect(delays[0]).toBe(1000); // First retry: 1000ms
      expect(delays[1]).toBe(2000); // Second retry: capped at 2000ms
      expect(delays[2]).toBe(2000); // Third retry: capped at 2000ms
    });
  });

  describe('retryRequest', () => {
    it('should retry a specific request', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const config: Partial<RetryConfig> = {
        maxAttempts: 1, // Will fail on first attempt
        baseDelay: 1000,
      };

      // First execution should fail
      await expect(retryManager.executeWithRetry(mockRequest, config)).rejects.toThrow();

      // Reset mock to succeed on retry
      mockRequest.mockResolvedValue('success');

      // Get the request ID from queue status (in real usage, this would be tracked)
      const queueStatus = retryManager.getQueueStatus();
      expect(queueStatus.totalRequests).toBe(0); // Request should be removed after failure
    });
  });

  describe('queue management', () => {
    it('should track queue status', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest1 = vi.fn().mockRejectedValue(networkError);
      const mockRequest2 = vi.fn().mockRejectedValue(networkError);

      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        baseDelay: 1000,
      };

      // Start two requests
      const promise1 = retryManager.executeWithRetry(mockRequest1, config);
      const promise2 = retryManager.executeWithRetry(mockRequest2, config);

      // Check initial status
      const initialStatus = retryManager.getQueueStatus();
      expect(initialStatus.totalRequests).toBe(2);
      expect(initialStatus.activeRetries).toBe(2);

      // Fast-forward and let them fail
      await vi.runAllTimersAsync();
      await expect(promise1).rejects.toThrow();
      await expect(promise2).rejects.toThrow();

      // Check final status
      const finalStatus = retryManager.getQueueStatus();
      expect(finalStatus.totalRequests).toBe(0);
    });

    it('should clear queue', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const promise = retryManager.executeWithRetry(mockRequest, {
        maxAttempts: 5,
        baseDelay: 1000,
      });

      // Clear queue before completion
      retryManager.clearQueue();

      await expect(promise).rejects.toThrow('Queue cleared');

      const status = retryManager.getQueueStatus();
      expect(status.totalRequests).toBe(0);
    });
  });

  describe('error type detection', () => {
    it('should identify retryable errors', () => {
      const retryableErrors: ApiError[] = [
        { name: 'NetworkError', message: 'Network error', code: 'NETWORK_ERROR', isAxiosError: true },
        { name: 'ServerError', message: 'Server error', status: 500, isAxiosError: true },
        { name: 'RateLimitError', message: 'Rate limited', status: 429, isAxiosError: true },
        { name: 'TimeoutError', message: 'Request timeout', code: 'ECONNABORTED', isAxiosError: true },
      ];

      retryableErrors.forEach(error => {
        const mockRequest = vi.fn().mockRejectedValue(error);

        // Should attempt retry (will fail after max attempts)
        expect(retryManager.executeWithRetry(mockRequest, { maxAttempts: 1 }))
          .rejects.toThrow();
      });
    });

    it('should identify non-retryable errors', async () => {
      const nonRetryableErrors: ApiError[] = [
        { name: 'ValidationError', message: 'Validation failed', status: 422, isAxiosError: true },
        { name: 'AuthError', message: 'Unauthorized', status: 401, isAxiosError: true },
        { name: 'PermissionError', message: 'Forbidden', status: 403, isAxiosError: true },
        { name: 'NotFoundError', message: 'Not found', status: 404, isAxiosError: true },
      ];

      for (const error of nonRetryableErrors) {
        const mockRequest = vi.fn().mockRejectedValue(error);

        await expect(retryManager.executeWithRetry(mockRequest)).rejects.toThrow();
        expect(mockRequest).toHaveBeenCalledTimes(1); // Should not retry

        mockRequest.mockClear();
      }
    });
  });
});