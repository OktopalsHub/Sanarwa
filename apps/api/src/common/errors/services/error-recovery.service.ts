import { Injectable, Logger } from "@nestjs/common";
import { ClassifiedError, RecoveryStrategy } from "../types/error.types";
import { CircuitBreakerService } from "./circuit-breaker.service";

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  async attemptRecovery<T>(
    error: ClassifiedError,
    operation: () => Promise<T>,
    strategies: RecoveryStrategy[] = [],
  ): Promise<T> {
    this.logger.debug(`Attempting recovery for error: ${error.code}`);

    if (strategies.length === 0) {
      strategies = this.getDefaultStrategies(error);
    }

    let lastError = error;

    for (const strategy of strategies) {
      try {
        const result = await this.executeStrategy(strategy, operation, lastError);
        this.logger.log(`Recovery successful using strategy: ${strategy.type}`);
        return result;
      } catch (strategyError) {
        this.logger.warn(`Recovery strategy ${strategy.type} failed:`, strategyError.message);
        lastError = strategyError as typeof lastError;
      }
    }

    throw lastError;
  }

  private async executeStrategy<T>(
    strategy: RecoveryStrategy,
    operation: () => Promise<T>,
    error: ClassifiedError,
  ): Promise<T> {
    switch (strategy.type) {
      case "retry":
        return this.executeRetryStrategy(strategy, operation, error);
      case "fallback":
        return this.executeFallbackStrategy(strategy, operation, error);
      case "circuit_breaker":
        return this.executeCircuitBreakerStrategy(strategy, operation, error);
      case "graceful_degradation":
        return this.executeGracefulDegradationStrategy(strategy, operation, error);
      default:
        throw new Error(`Unknown recovery strategy: ${strategy.type}`);
    }
  }

  private async executeRetryStrategy<T>(
    strategy: RecoveryStrategy,
    operation: () => Promise<T>,
    error: ClassifiedError,
  ): Promise<T> {
    const maxAttempts = strategy.maxAttempts || 3;
    const initialDelay = strategy.initialDelay || 1000;
    const backoffMultiplier = strategy.backoffMultiplier || 2;
    const maxDelay = strategy.maxDelay || 30000;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxAttempts) {
      attempt++;

      if (attempt > 1) {
        this.logger.debug(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay`);
        await this.sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }

      try {
        return await operation();
      } catch (retryError) {
        if (attempt === maxAttempts) {
          throw retryError;
        }

        if (strategy.condition && !strategy.condition(error)) {
          throw retryError;
        }

        this.logger.warn(`Retry attempt ${attempt} failed:`, retryError.message);
      }
    }

    throw error;
  }

  private async executeFallbackStrategy<T>(
    strategy: RecoveryStrategy,
    operation: () => Promise<T>,
    error: ClassifiedError,
  ): Promise<T> {
    try {
      return await operation();
    } catch (operationError) {
      this.logger.warn("Primary operation failed, using fallback value");

      if (strategy.fallbackValue !== undefined) {
        return strategy.fallbackValue;
      }

      throw operationError;
    }
  }

  private async executeCircuitBreakerStrategy<T>(
    strategy: RecoveryStrategy,
    operation: () => Promise<T>,
    error: ClassifiedError,
  ): Promise<T> {
    const serviceName = error.context.metadata?.serviceName || "unknown-service";

    return this.circuitBreakerService.execute(serviceName, operation, error.context);
  }

  private async executeGracefulDegradationStrategy<T>(
    strategy: RecoveryStrategy,
    operation: () => Promise<T>,
    error: ClassifiedError,
  ): Promise<T> {
    try {
      return await operation();
    } catch (operationError) {
      this.logger.warn("Operation failed, attempting graceful degradation");

      if (strategy.fallbackValue !== undefined) {
        this.logger.log("Using degraded fallback response");
        return strategy.fallbackValue;
      }

      return this.createDegradedResponse<T>(error);
    }
  }

  private getDefaultStrategies(error: ClassifiedError): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];

    if (error.retryable) {
      strategies.push({
        type: "retry",
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
        condition: (err) => err.retryable,
      });
    }

    if (error.category === "provider") {
      strategies.push({
        type: "circuit_breaker",
      });
    }

    if (error.recoverable) {
      strategies.push({
        type: "graceful_degradation",
        fallbackValue: this.createDegradedResponse(error),
      });
    }

    return strategies;
  }

  private createDegradedResponse<T>(error: ClassifiedError): T {
    const degradedResponse = {
      success: false,
      degraded: true,
      message: "Service is operating in degraded mode",
      error: {
        code: error.code,
        message: error.userMessage,
      },
      timestamp: new Date().toISOString(),
    };

    return degradedResponse as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  shouldAttemptRecovery(error: ClassifiedError): boolean {
    if (error.category === "validation") {
      return false;
    }

    if (error.category === "authentication" || error.category === "authorization") {
      return false;
    }

    return error.retryable || error.recoverable;
  }

  async getRecoveryMetrics(): Promise<Record<string, any>> {
    return {
      circuitBreakerMetrics: await this.circuitBreakerService.getMetrics(),
    };
  }
}
