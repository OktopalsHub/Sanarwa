import { Test, TestingModule } from "@nestjs/testing";
import { CircuitBreakerException } from "../exceptions/base.exception";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import Redis from "ioredis-mock";
import type { Mock } from "vitest";

describe("CircuitBreakerService", () => {
  let service: CircuitBreakerService;
  let redis: Redis;

  beforeEach(async () => {
    redis = new Redis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: getRedisConnectionToken(),
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    await redis.flushall();
  });

  describe("registerCircuit", () => {
    it("should register a circuit with default config", async () => {
      await service.registerCircuit("test-service");
      const state = await service.getCircuitState("test-service");

      expect(state.state).toBe("CLOSED");
      expect(state.failureCount).toBe(0);
    });

    it("should register a circuit with custom config", async () => {
      await service.registerCircuit("test-service", { failureThreshold: 10 });
      const state = await service.getCircuitState("test-service");

      expect(state.state).toBe("CLOSED");
      expect(state.failureCount).toBe(0);
    });
  });

  describe("execute", () => {
    it("should execute operation successfully when circuit is closed", async () => {
      const mockOperation = vi.fn().mockResolvedValue("success");

      const result = await service.execute("test-service", mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should throw CircuitBreakerException when circuit is open", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Service error"));

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("test-service", mockOperation);
        } catch (error) {}
      }

      await expect(service.execute("test-service", mockOperation)).rejects.toThrow(
        CircuitBreakerException,
      );
    });

    it("should transition to half-open after recovery timeout", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Service error"));

      await service.registerCircuit("test-service", {
        failureThreshold: 2,
        recoveryTimeout: 100,
      });

      for (let i = 0; i < 2; i++) {
        try {
          await service.execute("test-service", mockOperation);
        } catch (error) {}
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockOperation.mockResolvedValueOnce("success");

      const result = await service.execute("test-service", mockOperation);
      expect(result).toBe("success");
    });

    it("should reset failure count on successful operation", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValue("success");

      try {
        await service.execute("test-service", mockOperation);
      } catch (error) {}

      const result = await service.execute("test-service", mockOperation);
      expect(result).toBe("success");

      const state = await service.getCircuitState("test-service");
      expect(state.failureCount).toBe(0);
    });

    it("should track success count in half-open state", async () => {
      await service.registerCircuit("test-service", {
        failureThreshold: 1,
        recoveryTimeout: 100,
        halfOpenSuccessThreshold: 2,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Service error"))
        .mockResolvedValue("success");

      try {
        await service.execute("test-service", mockOperation);
      } catch (error) {}

      await new Promise((resolve) => setTimeout(resolve, 150));

      await service.execute("test-service", mockOperation);
      await service.execute("test-service", mockOperation);

      const state = await service.getCircuitState("test-service");
      expect(state.state).toBe("CLOSED");
    });
  });

  describe("manual control", () => {
    it("should manually open circuit", async () => {
      await service.registerCircuit("test-service");
      await service.openCircuit("test-service");

      const state = await service.getCircuitState("test-service");
      expect(state.state).toBe("OPEN");
      expect(state.lastFailureTime).toBeDefined();
      expect(state.nextAttemptTime).toBeDefined();
    });

    it("should manually close circuit", async () => {
      await service.registerCircuit("test-service");
      await service.openCircuit("test-service");
      await service.closeCircuit("test-service");

      const state = await service.getCircuitState("test-service");
      expect(state.state).toBe("CLOSED");
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
      expect(state.nextAttemptTime).toBeUndefined();
    });
  });

  describe("getMetrics", () => {
    it("should return metrics for all circuits", async () => {
      await service.registerCircuit("service-1");
      await service.registerCircuit("service-2");

      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty("service-1");
      expect(metrics).toHaveProperty("service-2");
      expect(metrics["service-1"]).toHaveProperty("state");
      expect(metrics["service-1"]).toHaveProperty("failureCount");
      expect(metrics["service-1"]).toHaveProperty("isHealthy");
    });

    it("should indicate healthy status for closed circuits", async () => {
      await service.registerCircuit("test-service");
      const metrics = await service.getMetrics();

      expect(metrics["test-service"].isHealthy).toBe(true);
    });

    it("should indicate unhealthy status for open circuits", async () => {
      await service.registerCircuit("test-service");
      await service.openCircuit("test-service");
      const metrics = await service.getMetrics();

      expect(metrics["test-service"].isHealthy).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should reset old circuit states", async () => {
      await service.registerCircuit("test-service");

      await redis.set(
        "circuit:state:test-service",
        JSON.stringify({
          state: "CLOSED",
          failureCount: 3,
          lastFailureTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        }),
      );

      await service.cleanup();

      const state = await service.getCircuitState("test-service");
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
    });
  });
});
