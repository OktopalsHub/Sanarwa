import { Test, TestingModule } from "@nestjs/testing";
import {
  ClassifiedError,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  RecoveryStrategy,
} from "../types/error.types";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { ErrorRecoveryService } from "./error-recovery.service";

describe("ErrorRecoveryService", () => {
  let service: ErrorRecoveryService;
  let circuitBreakerService: CircuitBreakerService;

  const mockError: ClassifiedError = {
    code: ErrorCode.PROVIDER_ERROR,
    category: ErrorCategory.PROVIDER,
    severity: ErrorSeverity.HIGH,
    message: "Provider failed",
    userMessage: "Service temporarily unavailable",
    statusCode: 503,
    context: {
      correlationId: "test-correlation-id",
      timestamp: new Date(),
    },
    retryable: true,
    recoverable: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorRecoveryService, CircuitBreakerService],
    }).compile();

    service = module.get<ErrorRecoveryService>(ErrorRecoveryService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  describe("attemptRecovery", () => {
    it("should recover using retry strategy", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValue("success");

      const strategies: RecoveryStrategy[] = [
        {
          type: "retry",
          maxAttempts: 2,
          initialDelay: 10, // Short delay for testing
        },
      ];

      const result = await service.attemptRecovery(mockError, mockOperation, strategies);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should recover using fallback strategy", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Operation failed"));
      const fallbackValue = "fallback-result";

      const strategies: RecoveryStrategy[] = [
        {
          type: "fallback",
          fallbackValue,
        },
      ];

      const result = await service.attemptRecovery(mockError, mockOperation, strategies);

      expect(result).toBe(fallbackValue);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should recover using circuit breaker strategy", async () => {
      const mockOperation = vi.fn().mockResolvedValue("success");
      const serviceName = "test-service";

      const errorWithServiceName: ClassifiedError = {
        ...mockError,
        context: {
          ...mockError.context,
          metadata: { serviceName },
        },
      };

      const strategies: RecoveryStrategy[] = [
        {
          type: "circuit_breaker",
        },
      ];

      const result = await service.attemptRecovery(errorWithServiceName, mockOperation, strategies);

      expect(result).toBe("success");
    });

    it("should recover using graceful degradation strategy", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Operation failed"));
      const degradedValue = { degraded: true, message: "Degraded response" };

      const strategies: RecoveryStrategy[] = [
        {
          type: "graceful_degradation",
          fallbackValue: degradedValue,
        },
      ];

      const result = await service.attemptRecovery(mockError, mockOperation, strategies);

      expect(result).toEqual(degradedValue);
    });

    it("should use default strategies when none provided", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValue("success");

      const result = await service.attemptRecovery(mockError, mockOperation);

      expect(result).toBe("success");
    });

    it("should throw error when all strategies fail", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Persistent failure"));

      const strategies: RecoveryStrategy[] = [
        {
          type: "retry",
          maxAttempts: 2,
          initialDelay: 10,
        },
      ];

      await expect(service.attemptRecovery(mockError, mockOperation, strategies)).rejects.toThrow(
        "Persistent failure",
      );
    });
  });

  describe("retry strategy", () => {
    it("should implement exponential backoff", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Failure 1"))
        .mockRejectedValueOnce(new Error("Failure 2"))
        .mockResolvedValue("success");

      const strategies: RecoveryStrategy[] = [
        {
          type: "retry",
          maxAttempts: 3,
          initialDelay: 10,
          backoffMultiplier: 2,
        },
      ];

      const startTime = Date.now();
      const result = await service.attemptRecovery(mockError, mockOperation, strategies);
      const endTime = Date.now();

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(3);
      // Should have some delay due to backoff (at least 10ms + 20ms)
      expect(endTime - startTime).toBeGreaterThan(25);
    });

    it("should respect max delay", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Failure 1"))
        .mockResolvedValue("success");

      const strategies: RecoveryStrategy[] = [
        {
          type: "retry",
          maxAttempts: 2,
          initialDelay: 100,
          backoffMultiplier: 10,
          maxDelay: 50, // Lower than calculated delay
        },
      ];

      const startTime = Date.now();
      const result = await service.attemptRecovery(mockError, mockOperation, strategies);
      const endTime = Date.now();

      expect(result).toBe("success");
      // Should not exceed maxDelay significantly (allowing some buffer for test execution)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it("should stop retrying when condition is not met", async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error("Non-retryable error"));

      const nonRetryableError: ClassifiedError = {
        ...mockError,
        retryable: false,
      };

      const strategies: RecoveryStrategy[] = [
        {
          type: "retry",
          maxAttempts: 3,
          initialDelay: 10,
          condition: (error) => error.retryable,
        },
      ];

      await expect(
        service.attemptRecovery(nonRetryableError, mockOperation, strategies),
      ).rejects.toThrow("Non-retryable error");

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe("shouldAttemptRecovery", () => {
    it("should return false for validation errors", () => {
      const validationError: ClassifiedError = {
        ...mockError,
        category: ErrorCategory.VALIDATION,
        retryable: false,
        recoverable: false,
      };

      expect(service.shouldAttemptRecovery(validationError)).toBe(false);
    });

    it("should return false for authentication errors", () => {
      const authError: ClassifiedError = {
        ...mockError,
        category: ErrorCategory.AUTHENTICATION,
        retryable: false,
        recoverable: false,
      };

      expect(service.shouldAttemptRecovery(authError)).toBe(false);
    });

    it("should return false for authorization errors", () => {
      const authzError: ClassifiedError = {
        ...mockError,
        category: ErrorCategory.AUTHORIZATION,
        retryable: false,
        recoverable: false,
      };

      expect(service.shouldAttemptRecovery(authzError)).toBe(false);
    });

    it("should return true for retryable errors", () => {
      const retryableError: ClassifiedError = {
        ...mockError,
        category: ErrorCategory.PROVIDER,
        retryable: true,
        recoverable: false,
      };

      expect(service.shouldAttemptRecovery(retryableError)).toBe(true);
    });

    it("should return true for recoverable errors", () => {
      const recoverableError: ClassifiedError = {
        ...mockError,
        category: ErrorCategory.SYSTEM,
        retryable: false,
        recoverable: true,
      };

      expect(service.shouldAttemptRecovery(recoverableError)).toBe(true);
    });
  });

  describe("getRecoveryMetrics", () => {
    it("should return recovery metrics", () => {
      const metrics = service.getRecoveryMetrics();

      expect(metrics).toHaveProperty("circuitBreakerMetrics");
      expect(typeof metrics.circuitBreakerMetrics).toBe("object");
    });
  });
});
