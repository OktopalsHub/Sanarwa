import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerException } from '../exceptions/base.exception';
import { CircuitBreakerService } from './circuit-breaker.service';
import type { Mock } from 'vitest';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  describe('registerCircuit', () => {
    it('should register a circuit with default config', () => {
      service.registerCircuit('test-service');
      const state = service.getCircuitState('test-service');

      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should register a circuit with custom config', () => {
      service.registerCircuit('test-service', { failureThreshold: 10 });
      const state = service.getCircuitState('test-service');

      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute operation successfully when circuit is closed', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await service.execute('test-service', mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should throw CircuitBreakerException when circuit is open', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('Service error'));

      // Force failures to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-service', mockOperation);
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should now be open
      await expect(
        service.execute('test-service', mockOperation),
      ).rejects.toThrow(CircuitBreakerException);
    });

    it('should transition to half-open after recovery timeout', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('Service error'));

      // Register circuit with short recovery timeout for testing
      service.registerCircuit('test-service', {
        failureThreshold: 2,
        recoveryTimeout: 100,
      });

      // Force failures to open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute('test-service', mockOperation);
        } catch (error) {
          // Expected failures
        }
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Mock successful operation
      mockOperation.mockResolvedValueOnce('success');

      const result = await service.execute('test-service', mockOperation);
      expect(result).toBe('success');
    });

    it('should reset failure count on successful operation', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');

      // First call fails
      try {
        await service.execute('test-service', mockOperation);
      } catch (error) {
        // Expected failure
      }

      // Second call succeeds
      const result = await service.execute('test-service', mockOperation);
      expect(result).toBe('success');

      const state = service.getCircuitState('test-service');
      expect(state.failureCount).toBe(0);
    });

    it('should track success count in half-open state', async () => {
      service.registerCircuit('test-service', {
        failureThreshold: 1,
        recoveryTimeout: 100,
        halfOpenSuccessThreshold: 2,
      });

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValue('success');

      // Force failure to open circuit
      try {
        await service.execute('test-service', mockOperation);
      } catch (error) {
        // Expected failure
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Execute successful operations in half-open state
      await service.execute('test-service', mockOperation);
      await service.execute('test-service', mockOperation);

      const state = service.getCircuitState('test-service');
      expect(state.state).toBe('CLOSED');
    });
  });

  describe('manual control', () => {
    it('should manually open circuit', () => {
      service.registerCircuit('test-service');
      service.openCircuit('test-service');

      const state = service.getCircuitState('test-service');
      expect(state.state).toBe('OPEN');
      expect(state.lastFailureTime).toBeDefined();
      expect(state.nextAttemptTime).toBeDefined();
    });

    it('should manually close circuit', () => {
      service.registerCircuit('test-service');
      service.openCircuit('test-service');
      service.closeCircuit('test-service');

      const state = service.getCircuitState('test-service');
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
      expect(state.nextAttemptTime).toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for all circuits', () => {
      service.registerCircuit('service-1');
      service.registerCircuit('service-2');

      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('service-1');
      expect(metrics).toHaveProperty('service-2');
      expect(metrics['service-1']).toHaveProperty('state');
      expect(metrics['service-1']).toHaveProperty('failureCount');
      expect(metrics['service-1']).toHaveProperty('isHealthy');
    });

    it('should indicate healthy status for closed circuits', () => {
      service.registerCircuit('test-service');
      const metrics = service.getMetrics();

      expect(metrics['test-service'].isHealthy).toBe(true);
    });

    it('should indicate unhealthy status for open circuits', () => {
      service.registerCircuit('test-service');
      service.openCircuit('test-service');
      const metrics = service.getMetrics();

      expect(metrics['test-service'].isHealthy).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should reset old circuit states', () => {
      service.registerCircuit('test-service');

      // Simulate old failure
      const state = service.getCircuitState('test-service');
      state.failureCount = 3;
      state.lastFailureTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      service.cleanup();

      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeUndefined();
    });
  });
});
