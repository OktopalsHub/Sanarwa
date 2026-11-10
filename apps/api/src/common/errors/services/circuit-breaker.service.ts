import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { CircuitBreakerException } from "../exceptions/base.exception";
import { CircuitBreakerState } from "../types/error.types";

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  halfOpenSuccessThreshold: number;
}

interface StoredCircuitState {
  state: CircuitBreakerState["state"];
  failureCount: number;
  successCount?: number;
  lastFailureTime?: string;
  nextAttemptTime?: string;
}

const DEFAULT_CIRCUIT_STATE: StoredCircuitState = {
  state: "CLOSED",
  failureCount: 0,
};

const SERVICES_KEY = "circuit:services";
const stateKey = (serviceName: string) => `circuit:state:${serviceName}`;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly configs = new Map<string, CircuitBreakerConfig>();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringPeriod: 10000,
    halfOpenMaxCalls: 3,
    halfOpenSuccessThreshold: 2,
  };

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async registerCircuit(
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>,
  ): Promise<void> {
    this.configs.set(serviceName, { ...this.defaultConfig, ...config });

    await this.redis.sadd(SERVICES_KEY, serviceName);
    await this.setCircuitStateIfAbsent(serviceName, { ...DEFAULT_CIRCUIT_STATE });

    this.logger.log(`Circuit breaker registered for service: ${serviceName}`);
  }

  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: any = {},
  ): Promise<T> {
    const circuit = await this.getOrCreateCircuit(serviceName);
    const config = this.getConfig(serviceName);

    if (circuit.state === "OPEN") {
      if (this.shouldAttemptReset(circuit, config)) {
        await this.transitionToHalfOpen(serviceName);
      } else {
        throw new CircuitBreakerException(serviceName, context);
      }
    }

    try {
      const result = await operation();
      await this.onSuccess(serviceName, config);
      return result;
    } catch (error) {
      await this.onFailure(serviceName, config, error);
      throw error;
    }
  }

  async getCircuitState(serviceName: string): Promise<CircuitBreakerState> {
    return this.getOrCreateCircuit(serviceName);
  }

  async openCircuit(serviceName: string): Promise<void> {
    const circuit = await this.getOrCreateCircuit(serviceName);
    circuit.state = "OPEN";
    circuit.lastFailureTime = new Date();
    circuit.nextAttemptTime = new Date(Date.now() + this.getConfig(serviceName).recoveryTimeout);
    await this.writeCircuit(serviceName, circuit);

    this.logger.warn(`Circuit breaker manually opened for service: ${serviceName}`);
  }

  async closeCircuit(serviceName: string): Promise<void> {
    const closed: StoredCircuitState = { state: "CLOSED", failureCount: 0, successCount: 0 };
    await this.redis.set(stateKey(serviceName), JSON.stringify(closed));

    this.logger.log(`Circuit breaker manually closed for service: ${serviceName}`);
  }

  async getMetrics(): Promise<Record<string, any>> {
    const serviceNames = await this.redis.smembers(SERVICES_KEY);
    const metrics: Record<string, any> = {};

    for (const serviceName of serviceNames) {
      const circuit = await this.readCircuit(serviceName);
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

  async cleanup(): Promise<void> {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000;

    const serviceNames = await this.redis.smembers(SERVICES_KEY);
    for (const serviceName of serviceNames) {
      const circuit = await this.readCircuit(serviceName);
      if (
        circuit.lastFailureTime &&
        now - new Date(circuit.lastFailureTime).getTime() > cleanupThreshold &&
        circuit.state === "CLOSED"
      ) {
        await this.redis.set(stateKey(serviceName), JSON.stringify({ ...DEFAULT_CIRCUIT_STATE }));
      }
    }
  }

  private async getOrCreateCircuit(serviceName: string): Promise<CircuitBreakerState> {
    const stored = await this.readCircuitRaw(serviceName);
    if (stored) {
      return this.revive(stored);
    }

    await this.registerCircuit(serviceName);
    return this.revive({ ...DEFAULT_CIRCUIT_STATE });
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

  private async transitionToHalfOpen(serviceName: string): Promise<void> {
    const halfOpen: StoredCircuitState = {
      state: "HALF_OPEN",
      failureCount: 0,
      successCount: 0,
    };
    await this.redis.set(stateKey(serviceName), JSON.stringify(halfOpen));

    this.logger.log(`Circuit breaker transitioned to HALF_OPEN for service: ${serviceName}`);
  }

  private async onSuccess(serviceName: string, config: CircuitBreakerConfig): Promise<void> {
    const circuit = await this.getOrCreateCircuit(serviceName);

    if (circuit.state === "HALF_OPEN") {
      circuit.successCount = (circuit.successCount || 0) + 1;

      if (circuit.successCount >= config.halfOpenSuccessThreshold) {
        await this.transitionToClosed(serviceName);
        return;
      }
    } else if (circuit.state === "CLOSED") {
      circuit.failureCount = 0;
    }

    await this.writeCircuit(serviceName, circuit);
  }

  private async onFailure(
    serviceName: string,
    config: CircuitBreakerConfig,
    error: any,
  ): Promise<void> {
    const circuit = await this.getOrCreateCircuit(serviceName);

    circuit.failureCount++;
    circuit.lastFailureTime = new Date();

    if (
      circuit.state === "HALF_OPEN" ||
      (circuit.state === "CLOSED" && circuit.failureCount >= config.failureThreshold)
    ) {
      await this.transitionToOpen(serviceName, config, circuit);
    } else {
      await this.writeCircuit(serviceName, circuit);
    }

    this.logger.error(
      `Circuit breaker failure for service: ${serviceName}, count: ${circuit.failureCount}`,
      error?.stack,
    );
  }

  private async transitionToClosed(serviceName: string): Promise<void> {
    await this.redis.set(
      stateKey(serviceName),
      JSON.stringify({ state: "CLOSED", failureCount: 0, successCount: 0 }),
    );

    this.logger.log(`Circuit breaker transitioned to CLOSED for service: ${serviceName}`);
  }

  private async transitionToOpen(
    serviceName: string,
    config: CircuitBreakerConfig,
    circuit: CircuitBreakerState,
  ): Promise<void> {
    const open: StoredCircuitState = {
      state: "OPEN",
      failureCount: circuit.failureCount,
      lastFailureTime: new Date().toISOString(),
      nextAttemptTime: new Date(Date.now() + config.recoveryTimeout).toISOString(),
    };

    await this.redis.set(stateKey(serviceName), JSON.stringify(open));

    this.logger.warn(
      `Circuit breaker transitioned to OPEN for service: ${serviceName}, next attempt at: ${open.nextAttemptTime}`,
    );
  }

  private async setCircuitStateIfAbsent(
    serviceName: string,
    state: StoredCircuitState,
  ): Promise<void> {
    await this.redis.set(stateKey(serviceName), JSON.stringify(state), "NX");
  }

  private async readCircuitRaw(serviceName: string): Promise<StoredCircuitState | null> {
    const raw = await this.redis.get(stateKey(serviceName));
    return raw ? (JSON.parse(raw) as StoredCircuitState) : null;
  }

  private async readCircuit(serviceName: string): Promise<CircuitBreakerState> {
    const stored = await this.readCircuitRaw(serviceName);
    return this.revive(stored ?? { ...DEFAULT_CIRCUIT_STATE });
  }

  private async writeCircuit(serviceName: string, circuit: CircuitBreakerState): Promise<void> {
    const stored: StoredCircuitState = {
      state: circuit.state,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      lastFailureTime: circuit.lastFailureTime?.toISOString(),
      nextAttemptTime: circuit.nextAttemptTime?.toISOString(),
    };
    await this.redis.set(stateKey(serviceName), JSON.stringify(stored));
  }

  private revive(stored: StoredCircuitState): CircuitBreakerState {
    return {
      state: stored.state,
      failureCount: stored.failureCount,
      successCount: stored.successCount,
      lastFailureTime: stored.lastFailureTime ? new Date(stored.lastFailureTime) : undefined,
      nextAttemptTime: stored.nextAttemptTime ? new Date(stored.nextAttemptTime) : undefined,
    };
  }
}
