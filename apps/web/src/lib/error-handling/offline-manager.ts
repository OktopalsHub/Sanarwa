import type { ApiError } from '@/lib/api/client';
import { errorToast } from './error-toast';
import { retryManager } from './retry-manager';

export interface OfflineRequest<T> {
  id: string;
  request: () => Promise<T>;
  data?: any;
  method: string;
  url: string;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  maxAge: number; // Maximum age in milliseconds before request is discarded
  onSuccess?: (result: T) => void;
  onError?: (error: ApiError) => void;
}

export interface OfflineQueuedRequest<T> extends OfflineRequest<T> {
  resolve: (value: T) => void;
  reject: (error: ApiError) => void;
}

export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
  queuedRequests: number;
  failedRequests: number;
  syncInProgress: boolean;
}

/**
 * Manages offline detection and request queuing for when the application goes offline
 */
export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline = navigator.onLine;
  private offlineQueue = new Map<string, OfflineQueuedRequest<any>>();
  private syncInProgress = false;
  private lastOnlineAt?: Date;
  private lastOfflineAt?: Date;
  private onlineListeners = new Set<(isOnline: boolean) => void>();
  private statusListeners = new Set<(status: OfflineStatus) => void>();

  private readonly STORAGE_KEY = 'notifi_offline_queue';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.setupEventListeners();
    this.loadQueueFromStorage();
    this.startPeriodicCleanup();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  /**
   * Execute a request with offline handling
   */
  async executeWithOfflineSupport<T>(
    request: () => Promise<T>,
    options: {
      method: string;
      url: string;
      data?: any;
      priority?: 'high' | 'medium' | 'low';
      maxAge?: number;
      onSuccess?: (result: T) => void;
      onError?: (error: ApiError) => void;
    }
  ): Promise<T> {
    const {
      method,
      url,
      data,
      priority = 'medium',
      maxAge = this.DEFAULT_MAX_AGE,
      onSuccess,
      onError,
    } = options;

    // If online, try to execute immediately
    if (this.isOnline) {
      try {
        const result = await request();
        onSuccess?.(result);
        return result;
      } catch (error) {
        const apiError = error as ApiError;

        // If it's a network error and we're actually offline, queue the request
        if (this.isNetworkError(apiError)) {
          this.handleOfflineTransition();
          return this.queueRequest(request, {
            method,
            url,
            data,
            priority,
            maxAge,
            onSuccess,
            onError,
          });
        }

        // Otherwise, handle the error normally
        onError?.(apiError);
        throw apiError;
      }
    }

    // If offline, queue the request
    return this.queueRequest(request, {
      method,
      url,
      data,
      priority,
      maxAge,
      onSuccess,
      onError,
    });
  }

  /**
   * Get current offline status
   */
  getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      lastOnlineAt: this.lastOnlineAt,
      lastOfflineAt: this.lastOfflineAt,
      queuedRequests: this.offlineQueue.size,
      failedRequests: Array.from(this.offlineQueue.values()).filter(
        req => this.isRequestExpired(req)
      ).length,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Add listener for online/offline status changes
   */
  addOnlineListener(listener: (isOnline: boolean) => void): () => void {
    this.onlineListeners.add(listener);
    return () => this.onlineListeners.delete(listener);
  }

  /**
   * Add listener for status changes
   */
  addStatusListener(listener: (status: OfflineStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Manually trigger sync of offline queue
   */
  async syncOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    this.notifyStatusListeners();

    try {
      const requests = Array.from(this.offlineQueue.values())
        .filter(req => !this.isRequestExpired(req))
        .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

      errorToast.showInfo(
        `Syncing ${requests.length} offline requests...`,
        { duration: 2000 }
      );

      let successCount = 0;
      let failureCount = 0;

      for (const queuedRequest of requests) {
        try {
          const result = await retryManager.executeWithRetry(
            queuedRequest.request,
            {
              maxAttempts: 2, // Fewer attempts for offline sync
              baseDelay: 500,
            }
          );

          // Success
          this.offlineQueue.delete(queuedRequest.id);
          queuedRequest.resolve(result);
          queuedRequest.onSuccess?.(result);
          successCount++;
        } catch (error) {
          const apiError = error as ApiError;

          // If it's still a network error, keep in queue
          if (this.isNetworkError(apiError)) {
            continue;
          }

          // Otherwise, remove from queue and reject
          this.offlineQueue.delete(queuedRequest.id);
          queuedRequest.reject(apiError);
          queuedRequest.onError?.(apiError);
          failureCount++;
        }
      }

      // Save updated queue
      this.saveQueueToStorage();

      // Show sync result
      if (successCount > 0) {
        errorToast.showSuccess(
          `Successfully synced ${successCount} requests`,
          failureCount > 0 ? {
            description: `${failureCount} requests failed`
          } : undefined
        );
      } else if (failureCount > 0) {
        errorToast.showWarning(
          `${failureCount} requests failed to sync`
        );
      }
    } finally {
      this.syncInProgress = false;
      this.notifyStatusListeners();
    }
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    // Reject all pending requests
    this.offlineQueue.forEach(queuedRequest => {
      const error = new Error('Offline queue cleared') as ApiError;
      error.code = 'QUEUE_CLEARED';
      queuedRequest.reject(error);
    });

    this.offlineQueue.clear();
    this.saveQueueToStorage();
    this.notifyStatusListeners();
  }

  /**
   * Get offline queue for debugging
   */
  getOfflineQueue(): Array<{
    id: string;
    method: string;
    url: string;
    priority: string;
    timestamp: Date;
    isExpired: boolean;
  }> {
    return Array.from(this.offlineQueue.values()).map(req => ({
      id: req.id,
      method: req.method,
      url: req.url,
      priority: req.priority,
      timestamp: req.timestamp,
      isExpired: this.isRequestExpired(req),
    }));
  }

  private async queueRequest<T>(
    request: () => Promise<T>,
    options: {
      method: string;
      url: string;
      data?: any;
      priority: 'high' | 'medium' | 'low';
      maxAge: number;
      onSuccess?: (result: T) => void;
      onError?: (error: ApiError) => void;
    }
  ): Promise<T> {
    // Check queue size limit
    if (this.offlineQueue.size >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority request
      this.removeOldestLowPriorityRequest();
    }

    const requestId = this.generateRequestId();

    return new Promise<T>((resolve, reject) => {
      const queuedRequest: OfflineQueuedRequest<T> = {
        id: requestId,
        request,
        method: options.method,
        url: options.url,
        data: options.data,
        priority: options.priority,
        maxAge: options.maxAge,
        timestamp: new Date(),
        onSuccess: options.onSuccess,
        onError: options.onError,
        resolve,
        reject,
      };

      this.offlineQueue.set(requestId, queuedRequest);
      this.saveQueueToStorage();
      this.notifyStatusListeners();

      // Show offline notification
      errorToast.showWarning(
        'You are offline. Request has been queued.',
        {
          description: 'It will be sent when connection is restored.',
          action: {
            label: 'View Queue',
            onClick: () => this.showQueueStatus(),
          },
        }
      );
    });
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen for visibility change to check connection
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Periodic connection check
    setInterval(() => this.checkConnection(), 30000); // Every 30 seconds
  }

  private handleOnline = (): void => {
    if (!this.isOnline) {
      this.isOnline = true;
      this.lastOnlineAt = new Date();

      errorToast.showSuccess('Connection restored');

      this.notifyOnlineListeners();
      this.notifyStatusListeners();

      // Auto-sync offline queue
      this.syncOfflineQueue();
    }
  };

  private handleOffline = (): void => {
    this.handleOfflineTransition();
  };

  private handleOfflineTransition(): void {
    if (this.isOnline) {
      this.isOnline = false;
      this.lastOfflineAt = new Date();

      errorToast.showWarning(
        'You are now offline',
        {
          description: 'Requests will be queued until connection is restored.',
          persistent: true,
        }
      );

      this.notifyOnlineListeners();
      this.notifyStatusListeners();
    }
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden) {
      // App became visible, check connection
      this.checkConnection();
    }
  };

  private async checkConnection(): Promise<void> {
    try {
      // Try to fetch a small resource to check connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok && !this.isOnline) {
        this.handleOnline();
      }
    } catch (error) {
      if (this.isOnline) {
        this.handleOfflineTransition();
      }
    }
  }

  private isNetworkError(error: ApiError): boolean {
    return error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network error') ||
      error.message?.includes('fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('Failed to fetch') ||
      !navigator.onLine;
  }

  private isRequestExpired(request: OfflineRequest<any>): boolean {
    return Date.now() - request.timestamp.getTime() > request.maxAge;
  }

  private getPriorityWeight(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private removeOldestLowPriorityRequest(): void {
    let oldestLowPriority: OfflineQueuedRequest<any> | null = null;

    for (const request of this.offlineQueue.values()) {
      if (request.priority === 'low') {
        if (!oldestLowPriority || request.timestamp < oldestLowPriority.timestamp) {
          oldestLowPriority = request;
        }
      }
    }

    if (oldestLowPriority) {
      this.offlineQueue.delete(oldestLowPriority.id);
      const error = new Error('Request removed due to queue size limit') as ApiError;
      error.code = 'QUEUE_FULL';
      oldestLowPriority.reject(error);
    }
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      const expiredRequests: string[] = [];

      this.offlineQueue.forEach((request, id) => {
        if (this.isRequestExpired(request)) {
          expiredRequests.push(id);
        }
      });

      expiredRequests.forEach(id => {
        const request = this.offlineQueue.get(id);
        if (request) {
          this.offlineQueue.delete(id);
          const error = new Error('Request expired') as ApiError;
          error.code = 'REQUEST_EXPIRED';
          request.reject(error);
        }
      });

      if (expiredRequests.length > 0) {
        this.saveQueueToStorage();
        this.notifyStatusListeners();
      }
    }, 60000); // Every minute
  }

  private saveQueueToStorage(): void {
    try {
      const queueData = Array.from(this.offlineQueue.entries()).map(([id, request]) => ({
        id,
        method: request.method,
        url: request.url,
        data: request.data,
        priority: request.priority,
        maxAge: request.maxAge,
        timestamp: request.timestamp.toISOString(),
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueData));
    } catch (error) {
      console.warn('Failed to save offline queue to storage:', error);
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const queueData = JSON.parse(stored);
      // Note: We can't restore the actual request functions from storage
      // This is mainly for showing queue status after page reload
      console.log('Offline queue from storage:', queueData);
    } catch (error) {
      console.warn('Failed to load offline queue from storage:', error);
    }
  }

  private showQueueStatus(): void {
    const status = this.getStatus();
    const queue = this.getOfflineQueue();

    console.log('Offline Queue Status:', status);
    console.log('Queued Requests:', queue);

    errorToast.showInfo(
      `${status.queuedRequests} requests queued`,
      {
        description: status.syncInProgress
          ? 'Sync in progress...'
          : 'Will sync when online',
      }
    );
  }

  private notifyOnlineListeners(): void {
    this.onlineListeners.forEach(listener => {
      try {
        listener(this.isOnline);
      } catch (error) {
        console.error('Error in online listener:', error);
      }
    });
  }

  private notifyStatusListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  private generateRequestId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const offlineManager = OfflineManager.getInstance();

// Convenience function for executing requests with offline support
export const executeWithOfflineSupport = <T>(
  request: () => Promise<T>,
  options: {
    method: string;
    url: string;
    data?: any;
    priority?: 'high' | 'medium' | 'low';
    maxAge?: number;
    onSuccess?: (result: T) => void;
    onError?: (error: ApiError) => void;
  }
) => offlineManager.executeWithOfflineSupport(request, options);