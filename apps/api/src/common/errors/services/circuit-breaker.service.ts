import { Injectable, Logger } from "@nestjs/common";
import { CircuitBreakerException } from "../exceptions/base.exception";
import { CircuitBreakerState } from "../types/error.types";

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  halfOpenSuccessThreshold: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitBreakerState>();
  private readonly configs = new Map<string, CircuitBreakerConfig>();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
    halfOpenMaxCalls: 3,
    halfOpenSuccessThreshold: 2,
  };

  /**
   * Register a circuit breaker for a service
   */
  registerCircuit(serviceName: string, config?: Partial<CircuitBreakerConfig>): void {
    const fullConfig = { ...this.defaultConfig, ...config };
    this.configs.set(serviceName, fullConfig);

    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: "CLOSED",
        failureCount: 0,
      });
    }

    this.logger.log(`Circuit breaker registered for service: ${serviceName}`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: any = {},
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName);
    const config = this.getConfig(serviceName);

    // Check if circuit is open
    if (circuit.state === "OPEN") {
      if (this.shouldAttemptReset(circuit, config)) {
        this.transitionToHalfOpen(serviceName, circuit);
      } else {
        throw new CircuitBreakerException(serviceName, context);
      }
    }

    // Execute operation
    try {
      const result = await operation();
      this.onSuccess(serviceName, circuit, config);
      return result;
    } catch (error) {
      this.onFailure(serviceName, circuit, config, error);
      throw error;
    }
  }

  /**
   * Get the current state of a circuit breaker
   */
  getCircuitState(serviceName: string): CircuitBreakerState {
    return this.getOrCreateCircuit(serviceName);
  }

  /**
   * Manually open a circuit breaker
   */
  openCircuit(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = "OPEN";
    circuit.lastFailureTime = new Date();
    circuit.nextAttemptTime = new Date(Date.now() + this.getConfig(serviceName).recoveryTimeout);

    this.logger.warn(`Circuit breaker manually opened for service: ${serviceName}`);
  }

  /**
   * Manually close a circuit breaker
   */
  closeCircuit(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = "CLOSED";
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.lastFailureTime = undefined;
    circuit.nextAttemptTime = undefined;

    this.logger.log(`Circuit breaker manually closed for service: ${serviceName}`);
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    for (const [serviceName, circuit] of this.circuits.entries()) {
      metrics[serviceName] = {
        state: circuit.state,
        failureCount: circuit.failureCount,
        successCount: circuit.successCount || 0,
        lastFailureTime: circuit.lastFailureTime,
        nextAttemptTime: circuit.nextAttemptTime,
        isHealthy: circuit.state === "CLOSED",
      };
    }

    return metrics;
  }

  private getOrCreateCircuit(serviceName: string): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.registerCircuit(serviceName);
    }
    return this.circuits.get(serviceName)!;
  }

  private getConfig(serviceName: string): CircuitBreakerConfig {
    return this.configs.get(serviceName) || this.defaultConfig;
  }

  private shouldAttemptReset(circuit: CircuitBreakerState, config: CircuitBreakerConfig): boolean {
    if (!circuit.nextAttemptTime) {
      return true;
    }
    return Date.now() >= circuit.nextAttemptTime.getTime();
  }

  private transitionToHalfOpen(serviceName: string, circuit: CircuitBreakerState): void {
    circuit.state = "HALF_OPEN";
    circuit.successCount = 0;
    circuit.failureCount = 0;

    this.logger.log(`Circuit breaker transitioned to HALF_OPEN for service: ${serviceName}`);
  }

  private onSuccess(
    serviceName: string,
    circuit: CircuitBreakerState,
    config: CircuitBreakerConfig,
  ): void {
    if (circuit.state === "HALF_OPEN") {
      circuit.successCount = (circuit.successCount || 0) + 1;

      if (circuit.successCount >= config.halfOpenSuccessThreshold) {
        this.transitionToClosed(serviceName, circuit);
      }
    } else if (circuit.state === "CLOSED") {
      // Reset failure count on successful operation
      circuit.failureCount = 0;
    }
  }

  private onFailure(
    serviceName: string,
    circuit: CircuitBreakerState,
    config: CircuitBreakerConfig,
    error: any,
  ): void {
    circuit.failureCount++;
    circuit.lastFailureTime = new Date();

    if (circuit.state === "HALF_OPEN") {
      this.transitionToOpen(serviceName, circuit, config);
    } else if (circuit.state === "CLOSED" && circuit.failureCount >= config.failureThreshold) {
      this.transitionToOpen(serviceName, circuit, config);
    }

    this.logger.error(
      `Circuit breaker failure for service: ${serviceName}, count: ${circuit.failureCount}`,
      error.stack,
    );
  }

  private transitionToClosed(serviceName: string, circuit: CircuitBreakerState): void {
    circuit.state = "CLOSED";
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.lastFailureTime = undefined;
    circuit.nextAttemptTime = undefined;

    this.logger.log(`Circuit breaker transitioned to CLOSED for service: ${serviceName}`);
  }

  private transitionToOpen(
    serviceName: string,
    circuit: CircuitBreakerState,
    config: CircuitBreakerConfig,
  ): void {
    circuit.state = "OPEN";
    circuit.nextAttemptTime = new Date(Date.now() + config.recoveryTimeout);

    this.logger.warn(
      `Circuit breaker transitioned to OPEN for service: ${serviceName}, next attempt at: ${circuit.nextAttemptTime}`,
    );
  }

  /**
   * Cleanup method to reset old circuit breaker states
   */
  cleanup(): void {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [serviceName, circuit] of this.circuits.entries()) {
      if (
        circuit.lastFailureTime &&
        now - circuit.lastFailureTime.getTime() > cleanupThreshold &&
        circuit.state === "CLOSED"
      ) {
        circuit.failureCount = 0;
        circuit.successCount = 0;
        circuit.lastFailureTime = undefined;
        circuit.nextAttemptTime = undefined;
      }
    }
  }
}
