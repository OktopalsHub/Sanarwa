import type { ApiError } from '@/lib/api/client';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { OfflineManager } from '../offline-manager';

// Mock dependencies
vi.mock('../error-toast', () => ({
  errorToast: {
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  },
}));

vi.mock('../retry-manager', () => ({
  retryManager: {
    executeWithRetry: vi.fn(),
  },
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
global.fetch = vi.fn();

// Mock timers
vi.useFakeTimers();

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;
  let mockErrorToast: {
    showWarning: Mock;
    showSuccess: Mock;
    showInfo: Mock;
  };
  let mockRetryManager: { executeWithRetry: Mock };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true });

    offlineManager = OfflineManager.getInstance();
    offlineManager.clearOfflineQueue();

    mockErrorToast = require('../error-toast').errorToast;
    mockRetryManager = require('../retry-manager').retryManager;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('executeWithOfflineSupport', () => {
    it('should execute request immediately when online', async () => {
      const mockRequest = vi.fn().mockResolvedValue('success');

      const result = await offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'GET',
        url: '/api/test',
      });

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockErrorToast.showWarning).not.toHaveBeenCalled();
    });

    it('should queue request when offline', async () => {
      // Set offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest = vi.fn().mockResolvedValue('success');

      const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'POST',
        url: '/api/test',
        data: { test: 'data' },
        priority: 'high',
      });

      // Should show offline warning
      expect(mockErrorToast.showWarning).toHaveBeenCalledWith(
        'You are offline. Request has been queued.',
        expect.objectContaining({
          description: 'It will be sent when connection is restored.',
        })
      );

      // Check queue status
      const status = offlineManager.getStatus();
      expect(status.isOnline).toBe(false);
      expect(status.queuedRequests).toBe(1);

      // Request should not have been executed yet
      expect(mockRequest).not.toHaveBeenCalled();

      // The promise should be pending (we can't easily test this without resolving it)
      // In a real scenario, it would resolve when coming back online
    });

    it('should queue request on network error when online', async () => {
      const networkError: ApiError = {
        name: 'NetworkError',
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(networkError);

      const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'GET',
        url: '/api/test',
      });

      // Should detect network error and transition to offline
      expect(mockErrorToast.showWarning).toHaveBeenCalledWith(
        'You are now offline',
        expect.objectContaining({
          description: 'Requests will be queued until connection is restored.',
        })
      );

      // Check that status changed to offline
      const status = offlineManager.getStatus();
      expect(status.isOnline).toBe(false);
      expect(status.queuedRequests).toBe(1);
    });

    it('should handle non-network errors normally when online', async () => {
      const validationError: ApiError = {
        name: 'ValidationError',
        message: 'Validation failed',
        status: 422,
        isAxiosError: true,
      };

      const mockRequest = vi.fn().mockRejectedValue(validationError);
      const onError = vi.fn();

      await expect(
        offlineManager.executeWithOfflineSupport(mockRequest, {
          method: 'POST',
          url: '/api/test',
          onError,
        })
      ).rejects.toThrow('Validation failed');

      expect(onError).toHaveBeenCalledWith(validationError);
      expect(mockErrorToast.showWarning).not.toHaveBeenCalled();
    });
  });

  describe('syncOfflineQueue', () => {
    it('should sync queued requests when coming online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest1 = vi.fn().mockResolvedValue('result1');
      const mockRequest2 = vi.fn().mockResolvedValue('result2');

      // Queue requests while offline
      const promise1 = offlineManager.executeWithOfflineSupport(mockRequest1, {
        method: 'GET',
        url: '/api/test1',
        priority: 'high',
      });

      const promise2 = offlineManager.executeWithOfflineSupport(mockRequest2, {
        method: 'POST',
        url: '/api/test2',
        priority: 'low',
      });

      expect(offlineManager.getStatus().queuedRequests).toBe(2);

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true });

      // Mock retry manager to execute requests
      mockRetryManager.executeWithRetry
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2');

      // Trigger sync
      await offlineManager.syncOfflineQueue();

      // Should show sync info
      expect(mockErrorToast.showInfo).toHaveBeenCalledWith(
        'Syncing 2 offline requests...',
        expect.any(Object)
      );

      // Should show success message
      expect(mockErrorToast.showSuccess).toHaveBeenCalledWith(
        'Successfully synced 2 requests'
      );

      // Queue should be empty
      expect(offlineManager.getStatus().queuedRequests).toBe(0);
    });

    it('should handle sync failures', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest = vi.fn().mockResolvedValue('result');

      const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'GET',
        url: '/api/test',
      });

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true });

      // Mock retry manager to fail
      const syncError: ApiError = {
        name: 'SyncError',
        message: 'Sync failed',
        status: 500,
        isAxiosError: true,
      };

      mockRetryManager.executeWithRetry.mockRejectedValue(syncError);

      await offlineManager.syncOfflineQueue();

      // Should show warning for failed sync
      expect(mockErrorToast.showWarning).toHaveBeenCalledWith(
        '1 requests failed to sync'
      );

      // Failed request should be removed from queue
      expect(offlineManager.getStatus().queuedRequests).toBe(0);
    });

    it('should prioritize high priority requests', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockLowPriority = vi.fn().mockResolvedValue('low');
      const mockHighPriority = vi.fn().mockResolvedValue('high');
      const mockMediumPriority = vi.fn().mockResolvedValue('medium');

      // Queue requests in different order
      await offlineManager.executeWithOfflineSupport(mockLowPriority, {
        method: 'GET',
        url: '/api/low',
        priority: 'low',
      });

      await offlineManager.executeWithOfflineSupport(mockHighPriority, {
        method: 'GET',
        url: '/api/high',
        priority: 'high',
      });

      await offlineManager.executeWithOfflineSupport(mockMediumPriority, {
        method: 'GET',
        url: '/api/medium',
        priority: 'medium',
      });

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true });

      // Mock retry manager to track execution order
      const executionOrder: string[] = [];
      mockRetryManager.executeWithRetry.mockImplementation(async (request) => {
        const result = await request();
        executionOrder.push(result);
        return result;
      });

      await offlineManager.syncOfflineQueue();

      // Should execute in priority order: high, medium, low
      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('online/offline detection', () => {
    it('should detect online/offline transitions', () => {
      const onlineListener = vi.fn();
      const statusListener = vi.fn();

      offlineManager.addOnlineListener(onlineListener);
      offlineManager.addStatusListener(statusListener);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));

      expect(onlineListener).toHaveBeenCalledWith(false);
      expect(statusListener).toHaveBeenCalled();
      expect(mockErrorToast.showWarning).toHaveBeenCalledWith(
        'You are now offline',
        expect.any(Object)
      );

      // Simulate coming online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));

      expect(onlineListener).toHaveBeenCalledWith(true);
      expect(mockErrorToast.showSuccess).toHaveBeenCalledWith('Connection restored');
    });

    it('should check connection periodically', async () => {
      // Mock fetch to succeed
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
      });

      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      // Fast-forward 30 seconds to trigger connection check
      vi.advanceTimersByTime(30000);

      // Should detect connection is back
      await vi.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
    });

    it('should handle connection check failures', async () => {
      // Mock fetch to fail
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      // Start online
      Object.defineProperty(navigator, 'onLine', { value: true });

      // Fast-forward 30 seconds to trigger connection check
      vi.advanceTimersByTime(30000);

      // Should detect connection is lost
      await vi.runAllTimersAsync();

      expect(offlineManager.getStatus().isOnline).toBe(false);
    });
  });

  describe('queue management', () => {
    it('should limit queue size', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      // Try to queue more than max size (100)
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 105; i++) {
        const mockRequest = vi.fn().mockResolvedValue(`result${i}`);
        const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
          method: 'GET',
          url: `/api/test${i}`,
          priority: i < 5 ? 'high' : 'low', // First 5 are high priority
        });
        promises.push(promise);
      }

      // Should not exceed max queue size
      const status = offlineManager.getStatus();
      expect(status.queuedRequests).toBeLessThanOrEqual(100);
    });

    it('should remove expired requests', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest = vi.fn().mockResolvedValue('result');

      // Queue request with short max age
      const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'GET',
        url: '/api/test',
        maxAge: 1000, // 1 second
      });

      expect(offlineManager.getStatus().queuedRequests).toBe(1);

      // Fast-forward past expiration
      vi.advanceTimersByTime(65000); // 65 seconds (cleanup runs every minute)

      // Should remove expired request
      expect(offlineManager.getStatus().queuedRequests).toBe(0);

      // Promise should be rejected
      await expect(promise).rejects.toThrow('Request expired');
    });

    it('should clear offline queue', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest = vi.fn().mockResolvedValue('result');

      const promise = offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'GET',
        url: '/api/test',
      });

      expect(offlineManager.getStatus().queuedRequests).toBe(1);

      offlineManager.clearOfflineQueue();

      expect(offlineManager.getStatus().queuedRequests).toBe(0);
      await expect(promise).rejects.toThrow('Offline queue cleared');
    });
  });

  describe('status and debugging', () => {
    it('should provide accurate status', () => {
      const status = offlineManager.getStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('queuedRequests');
      expect(status).toHaveProperty('failedRequests');
      expect(status).toHaveProperty('syncInProgress');
      expect(typeof status.isOnline).toBe('boolean');
      expect(typeof status.queuedRequests).toBe('number');
    });

    it('should provide queue details for debugging', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockRequest = vi.fn().mockResolvedValue('result');

      await offlineManager.executeWithOfflineSupport(mockRequest, {
        method: 'POST',
        url: '/api/test',
        data: { test: 'data' },
        priority: 'high',
      });

      const queue = offlineManager.getOfflineQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        method: 'POST',
        url: '/api/test',
        priority: 'high',
        isExpired: false,
      });
      expect(queue[0]).toHaveProperty('id');
      expect(queue[0]).toHaveProperty('timestamp');
    });
  });
});