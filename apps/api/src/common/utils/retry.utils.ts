import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryUtils {
  private static readonly logger = new Logger(RetryUtils.name);

  /**
   * Execute a function with exponential backoff retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      retryCondition = () => true,
      onRetry,
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (!retryCondition(lastError)) {
          throw lastError;
        }

        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          this.logger.error(
            `Operation failed after ${maxAttempts} attempts`,
            {
              error: lastError.message,
              stack: lastError.stack,
            }
          );
          throw lastError;
        }

        // Calculate next delay with exponential backoff
        const nextDelay = Math.min(delay * backoffMultiplier, maxDelay);

        // Add jitter to prevent thundering herd
        const jitteredDelay = nextDelay * (0.5 + Math.random() * 0.5);

        this.logger.warn(
          `Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(jitteredDelay)}ms`,
          {
            error: lastError.message,
            nextDelay: Math.round(jitteredDelay),
          }
        );

        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Wait before retrying
        await this.delay(jitteredDelay);
        delay = nextDelay;
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Execute a function with circuit breaker pattern
   */
  static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerKey: string,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 60000,
    } = options;

    // Simple in-memory circuit breaker state
    // In production, this should be stored in Redis or database
    const circuitState = this.getCircuitBreakerState(circuitBreakerKey);

    if (circuitState.state === 'OPEN') {
      if (Date.now() - circuitState.lastFailureTime < resetTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${circuitBreakerKey}`);
      } else {
        // Try to close the circuit
        circuitState.state = 'HALF_OPEN';
        circuitState.failureCount = 0;
      }
    }

    try {
      const result = await operation();

      // Success - reset failure count
      circuitState.failureCount = 0;
      circuitState.state = 'CLOSED';
      circuitState.lastSuccessTime = Date.now();

      return result;
    } catch (error) {
      // Failure - increment counter
      circuitState.failureCount++;
      circuitState.lastFailureTime = Date.now();

      if (circuitState.failureCount >= failureThreshold) {
        circuitState.state = 'OPEN';
        this.logger.error(
          `Circuit breaker OPENED for ${circuitBreakerKey} after ${circuitState.failureCount} failures`
        );
      }

      throw error;
    }
  }

  /**
   * Execute a function with timeout
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutError?: Error
  ): Promise<T> {
    timeoutMs = Math.max(0, timeoutMs);
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Execute a function with both retry and timeout
   */
  static async withRetryAndTimeout<T>(
    operation: () => Promise<T>,
    retryOptions: RetryOptions = {},
    timeoutMs: number = 30000
  ): Promise<T> {
    return this.withRetry(
      () => this.withTimeout(operation, timeoutMs),
      retryOptions
    );
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static circuitBreakerStates = new Map<string, {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
  }>();

  private static getCircuitBreakerState(key: string) {
    if (!this.circuitBreakerStates.has(key)) {
      this.circuitBreakerStates.set(key, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: Date.now(),
      });
    }
    return this.circuitBreakerStates.get(key)!;
  }

  /**
   * Check if an error should be retried
   */
  static isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'Network Error',
      'timeout',
      'rate limit',
      '429',
      '502',
      '503',
      '504',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern.toLowerCase()));
  }
}