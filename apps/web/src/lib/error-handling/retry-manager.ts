import type { ApiError } from '@/lib/api/client';
import { apiErrorHandler } from './api-error-handler';
import { errorToast } from './error-toast';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: ApiError, attempt: number) => boolean;
  onRetry?: (error: ApiError, attempt: number, delay: number) => void;
  onMaxAttemptsReached?: (error: ApiError, attempts: number) => void;
}

export interface RetryableRequest<T> {
  id: string;
  request: () => Promise<T>;
  config: RetryConfig;
  attempts: number;
  lastError?: ApiError;
  createdAt: Date;
  nextRetryAt?: Date;
}

export interface QueuedRequest<T> extends RetryableRequest<T> {
  resolve: (value: T) => void;
  reject: (error: ApiError) => void;
}

/**
 * Manages automatic retry logic for failed API requests with exponential backoff
 */
export class RetryManager {
  private static instance: RetryManager;
  private retryQueue = new Map<string, QueuedRequest<any>>();
  private activeRetries = new Set<string>();
  private retryTimers = new Map<string, NodeJS.Timeout>();

  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: ApiError) => this.isRetryableError(error),
  };

  private constructor() {
    // Clean up expired requests periodically
    setInterval(() => this.cleanupExpiredRequests(), 60000); // Every minute
  }

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * Execute a request with automatic retry logic
   */
  async executeWithRetry<T>(
    request: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const requestId = this.generateRequestId();

    return new Promise<T>((resolve, reject) => {
      const retryableRequest: QueuedRequest<T> = {
        id: requestId,
        request,
        config: finalConfig,
        attempts: 0,
        createdAt: new Date(),
        resolve,
        reject,
      };

      this.retryQueue.set(requestId, retryableRequest);
      this.executeRequest(requestId);
    });
  }

  /**
   * Retry a specific request by ID
   */
  async retryRequest(requestId: string): Promise<void> {
    const queuedRequest = this.retryQueue.get(requestId);
    if (!queuedRequest) {
      throw new Error(`Request ${requestId} not found in retry queue`);
    }

    // Clear any existing retry timer
    const timer = this.retryTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(requestId);
    }

    // Reset attempts and execute immediately
    queuedRequest.attempts = 0;
    queuedRequest.lastError = undefined;
    queuedRequest.nextRetryAt = undefined;

    await this.executeRequest(requestId);
  }

  /**
   * Cancel a retry request
   */
  cancelRetry(requestId: string): void {
    const queuedRequest = this.retryQueue.get(requestId);
    if (!queuedRequest) {
      return;
    }

    // Clear timer
    const timer = this.retryTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(requestId);
    }

    // Remove from queue and reject
    this.retryQueue.delete(requestId);
    this.activeRetries.delete(requestId);

    const error = new Error('Request cancelled') as ApiError;
    error.code = 'REQUEST_CANCELLED';
    queuedRequest.reject(error);
  }

  /**
   * Get retry queue status
   */
  getQueueStatus(): {
    totalRequests: number;
    activeRetries: number;
    pendingRetries: number;
    failedRequests: number;
  } {
    const totalRequests = this.retryQueue.size;
    const activeRetries = this.activeRetries.size;
    const pendingRetries = Array.from(this.retryQueue.values()).filter(
      req => req.nextRetryAt && req.nextRetryAt > new Date()
    ).length;
    const failedRequests = Array.from(this.retryQueue.values()).filter(
      req => req.attempts >= req.config.maxAttempts
    ).length;

    return {
      totalRequests,
      activeRetries,
      pendingRetries,
      failedRequests,
    };
  }

  /**
   * Clear all retry requests
   */
  clearQueue(): void {
    // Clear all timers
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();

    // Reject all pending requests
    this.retryQueue.forEach(queuedRequest => {
      const error = new Error('Queue cleared') as ApiError;
      error.code = 'QUEUE_CLEARED';
      queuedRequest.reject(error);
    });

    this.retryQueue.clear();
    this.activeRetries.clear();
  }

  /**
   * Get retry requests for debugging
   */
  getRetryRequests(): Array<{
    id: string;
    attempts: number;
    maxAttempts: number;
    lastError?: string;
    nextRetryAt?: Date;
    createdAt: Date;
  }> {
    return Array.from(this.retryQueue.values()).map(req => ({
      id: req.id,
      attempts: req.attempts,
      maxAttempts: req.config.maxAttempts,
      lastError: req.lastError?.message,
      nextRetryAt: req.nextRetryAt,
      createdAt: req.createdAt,
    }));
  }

  private async executeRequest<T>(requestId: string): Promise<void> {
    const queuedRequest = this.retryQueue.get(requestId) as QueuedRequest<T>;
    if (!queuedRequest) {
      return;
    }

    this.activeRetries.add(requestId);

    try {
      const result = await queuedRequest.request();

      // Success - clean up and resolve
      this.cleanupRequest(requestId);
      queuedRequest.resolve(result);

      // Show success toast if this was a retry
      if (queuedRequest.attempts > 0) {
        errorToast.showSuccess('Request completed successfully');
      }
    } catch (error) {
      this.activeRetries.delete(requestId);

      const apiError = error as ApiError;
      queuedRequest.attempts++;
      queuedRequest.lastError = apiError;

      // Check if we should retry
      const shouldRetry =
        queuedRequest.attempts < queuedRequest.config.maxAttempts &&
        (queuedRequest.config.retryCondition?.(apiError, queuedRequest.attempts) ?? true);

      if (shouldRetry) {
        await this.scheduleRetry(requestId, apiError);
      } else {
        // Max attempts reached or not retryable
        this.cleanupRequest(requestId);

        // Call max attempts callback
        queuedRequest.config.onMaxAttemptsReached?.(apiError, queuedRequest.attempts);

        // Handle the error through the centralized error handler
        const handledError = apiErrorHandler.handle(apiError, {
          context: 'RetryManager',
          showToast: true,
          customMessage: queuedRequest.attempts >= queuedRequest.config.maxAttempts
            ? `Request failed after ${queuedRequest.attempts} attempts`
            : undefined,
        });

        queuedRequest.reject(handledError);
      }
    }
  }

  private async scheduleRetry(requestId: string, error: ApiError): Promise<void> {
    const queuedRequest = this.retryQueue.get(requestId);
    if (!queuedRequest) {
      return;
    }

    const delay = this.calculateRetryDelay(error, queuedRequest.attempts, queuedRequest.config);
    queuedRequest.nextRetryAt = new Date(Date.now() + delay);

    // Call retry callback
    queuedRequest.config.onRetry?.(error, queuedRequest.attempts, delay);

    // Show retry toast
    errorToast.showWarning(
      `Request failed. Retrying in ${Math.round(delay / 1000)} seconds...`,
      {
        description: `Attempt ${queuedRequest.attempts} of ${queuedRequest.config.maxAttempts}`,
        action: {
          label: 'Retry Now',
          onClick: () => this.retryRequest(requestId),
        },
      }
    );

    // Schedule the retry
    const timer = setTimeout(() => {
      this.retryTimers.delete(requestId);
      this.executeRequest(requestId);
    }, delay);

    this.retryTimers.set(requestId, timer);
  }

  private calculateRetryDelay(error: ApiError, attempt: number, config: RetryConfig): number {
    let delay: number;

    // Use error-specific delay if available
    if (error.status === 429) {
      // Rate limit: use Retry-After header if available, otherwise exponential backoff
      delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    } else if (error.status && error.status >= 500) {
      // Server errors: exponential backoff
      delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    } else {
      // Other errors: linear backoff
      delay = config.baseDelay * attempt;
    }

    // Apply jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    // Cap at max delay
    return Math.min(delay, config.maxDelay);
  }

  private isRetryableError(error: ApiError): boolean {
    // Network errors are retryable
    if (error.code === 'NETWORK_ERROR' || this.isNetworkError(error)) {
      return true;
    }

    // 5xx server errors are retryable
    if (error.status && error.status >= 500) {
      return true;
    }

    // Rate limit errors are retryable
    if (error.status === 429) {
      return true;
    }

    // Timeout errors are retryable
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }

    // Connection errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      return true;
    }

    return false;
  }

  private isNetworkError(error: ApiError): boolean {
    return error.message?.includes('Network error') ||
      error.message?.includes('fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('Failed to fetch');
  }

  private cleanupRequest(requestId: string): void {
    this.retryQueue.delete(requestId);
    this.activeRetries.delete(requestId);

    const timer = this.retryTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(requestId);
    }
  }

  private cleanupExpiredRequests(): void {
    const now = new Date();
    const expiredRequests: string[] = [];

    this.retryQueue.forEach((request, id) => {
      // Remove requests older than 1 hour that have failed
      const isExpired = now.getTime() - request.createdAt.getTime() > 3600000; // 1 hour
      const hasFailed = request.attempts >= request.config.maxAttempts;

      if (isExpired && hasFailed) {
        expiredRequests.push(id);
      }
    });

    expiredRequests.forEach(id => {
      const request = this.retryQueue.get(id);
      if (request) {
        const error = new Error('Request expired') as ApiError;
        error.code = 'REQUEST_EXPIRED';
        request.reject(error);
        this.cleanupRequest(id);
      }
    });
  }

  private generateRequestId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const retryManager = RetryManager.getInstance();

// Convenience function for executing requests with retry
export const executeWithRetry = <T>(
  request: () => Promise<T>,
  config?: Partial<RetryConfig>
) => retryManager.executeWithRetry(request, config);