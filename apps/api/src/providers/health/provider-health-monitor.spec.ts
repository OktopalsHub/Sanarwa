import { Test, TestingModule } from '@nestjs/testing';
import { BaseProvider } from '../base/base-provider.abstract';
import { BaseProviderPayload } from '../base/base-provider.interface';
import {
import type { Mock } from 'vitest';
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from '../types';
import { ProviderHealthMonitor } from './provider-health-monitor';

// Mock provider for testing
class MockProvider extends BaseProvider {
  private shouldFailHealthCheck = false;

  constructor(id: string, name: string, channel: Channel) {
    super(id, name, channel);
  }

  async send(payload: BaseProviderPayload): Promise<ProviderResponse> {
    return this.createSuccessResponse('mock-message-id');
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return this.validateCommonConfig(config);
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    if (this.shouldFailHealthCheck) {
      throw new Error('Mock health check failure');
    }

    return {
      status: ProviderHealth.HEALTHY,
      lastChecked: new Date(),
      responseTime: 100,
      uptime: 99.9,
    };
  }

  setFailHealthCheck(fail: boolean): void {
    this.shouldFailHealthCheck = fail;
  }
}

describe('ProviderHealthMonitor', () => {
  let monitor: ProviderHealthMonitor;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderHealthMonitor],
    }).compile();

    monitor = module.get<ProviderHealthMonitor>(ProviderHealthMonitor);

    mockProvider1 = new MockProvider('provider-1', 'Provider 1', Channel.EMAIL);
    mockProvider2 = new MockProvider('provider-2', 'Provider 2', Channel.SMS);

    const config: ProviderConfig = {
      id: 'test-provider',
      name: 'Test Provider',
      channel: Channel.EMAIL,
      priority: 1,
      isActive: true,
      credentials: {},
    };

    await mockProvider1.initialize(config);
    await mockProvider2.initialize({
      ...config,
      id: 'provider-2',
      channel: Channel.SMS,
    });
  });

  afterEach(async () => {
    await mockProvider1.destroy();
    await mockProvider2.destroy();
    monitor.stopMonitoring();
    monitor.clearMetrics();
  });

  describe('provider registration', () => {
    it('should register a provider for monitoring', () => {
      monitor.registerProvider(mockProvider1);

      // Should not throw when checking health
      expect(async () => {
        await monitor.checkProviderHealth('provider-1', Channel.EMAIL);
      }).not.toThrow();
    });

    it('should unregister a provider from monitoring', () => {
      monitor.registerProvider(mockProvider1);
      monitor.unregisterProvider('provider-1', Channel.EMAIL);

      expect(
        monitor.checkProviderHealth('provider-1', Channel.EMAIL),
      ).rejects.toThrow(
        'Provider provider-1 for channel email is not registered',
      );
    });
  });

  describe('health checking', () => {
    beforeEach(() => {
      monitor.registerProvider(mockProvider1);
      monitor.registerProvider(mockProvider2);
    });

    it('should check health of a specific provider', async () => {
      const result = await monitor.checkProviderHealth(
        'provider-1',
        Channel.EMAIL,
      );

      expect(result.providerId).toBe('provider-1');
      expect(result.channel).toBe(Channel.EMAIL);
      expect(result.isHealthy).toBe(true);
      expect(result.status.status).toBe(ProviderHealth.HEALTHY);
      expect(result.metrics).toBeDefined();
    });

    it('should handle provider health check failures', async () => {
      mockProvider1.setFailHealthCheck(true);

      const result = await monitor.checkProviderHealth(
        'provider-1',
        Channel.EMAIL,
      );

      expect(result.isHealthy).toBe(false);
      expect(result.status.status).toBe(ProviderHealth.UNHEALTHY);
      expect(result.status.metadata?.error).toBe('Mock health check failure');
    });

    it('should check health of all providers for a channel', async () => {
      const results = await monitor.checkChannelHealth(Channel.EMAIL);

      expect(results).toHaveLength(1);
      expect(results[0].providerId).toBe('provider-1');
      expect(results[0].channel).toBe(Channel.EMAIL);
    });

    it('should check health of all registered providers', async () => {
      const results = await monitor.checkAllProvidersHealth();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.providerId)).toContain('provider-1');
      expect(results.map((r) => r.providerId)).toContain('provider-2');
    });

    it('should throw error for unregistered provider', async () => {
      await expect(
        monitor.checkProviderHealth('unregistered', Channel.EMAIL),
      ).rejects.toThrow(
        'Provider unregistered for channel email is not registered',
      );
    });
  });

  describe('metrics tracking', () => {
    beforeEach(() => {
      monitor.registerProvider(mockProvider1);
    });

    it('should record successful requests', async () => {
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 150);

      const metrics = await monitor.getProviderMetrics(
        'provider-1',
        Channel.EMAIL,
      );

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.lastSuccessfulRequest).toBeInstanceOf(Date);
    });

    it('should record failed requests', async () => {
      await monitor.recordFailure('provider-1', Channel.EMAIL, 'Test error');

      const metrics = await monitor.getProviderMetrics(
        'provider-1',
        Channel.EMAIL,
      );

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.lastFailedRequest).toBeInstanceOf(Date);
    });

    it('should calculate success rate correctly', async () => {
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 100);
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 200);
      await monitor.recordFailure('provider-1', Channel.EMAIL, 'Error');

      const metrics = await monitor.getProviderMetrics(
        'provider-1',
        Channel.EMAIL,
      );

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
      expect(metrics.averageResponseTime).toBe(100); // (100 + 200) / 2 successful requests
    });

    it('should handle metrics for new providers', async () => {
      await monitor.recordSuccess('new-provider', Channel.PUSH, 50);

      const metrics = await monitor.getProviderMetrics(
        'new-provider',
        Channel.PUSH,
      );

      expect(metrics.providerId).toBe('new-provider');
      expect(metrics.channel).toBe(Channel.PUSH);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should throw error for non-existent provider metrics', async () => {
      await expect(
        monitor.getProviderMetrics('non-existent', Channel.EMAIL),
      ).rejects.toThrow('No metrics found for provider non-existent (email)');
    });
  });

  describe('provider ranking', () => {
    beforeEach(async () => {
      monitor.registerProvider(mockProvider1);
      monitor.registerProvider(mockProvider2);

      // Set up different success rates
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 100);
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 100);
      await monitor.recordFailure('provider-1', Channel.EMAIL, 'Error');

      await monitor.recordSuccess('provider-2', Channel.EMAIL, 100);
    });

    it('should sort providers by health and success rate', async () => {
      // Register another email provider for comparison
      const mockProvider3 = new MockProvider(
        'provider-3',
        'Provider 3',
        Channel.EMAIL,
      );
      await mockProvider3.initialize({
        id: 'provider-3',
        name: 'Provider 3',
        channel: Channel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      });

      monitor.registerProvider(mockProvider3);

      // Make provider-1 unhealthy
      mockProvider1.setFailHealthCheck(true);

      const results = await monitor.getProvidersByHealth(Channel.EMAIL);

      // Healthy providers should come first, then sorted by success rate
      expect(results[0].isHealthy).toBe(true);
      expect(results[results.length - 1].isHealthy).toBe(false);

      await mockProvider3.destroy();
    });
  });

  describe('continuous monitoring', () => {
    beforeEach(() => {
      monitor.registerProvider(mockProvider1);
    });

    it('should start and stop continuous monitoring', (done) => {
      monitor.startMonitoring(100); // 100ms interval for testing

      setTimeout(() => {
        monitor.stopMonitoring();
        done();
      }, 250);
    });

    it('should handle errors during continuous monitoring', (done) => {
      mockProvider1.setFailHealthCheck(true);
      monitor.startMonitoring(100);

      setTimeout(() => {
        monitor.stopMonitoring();
        done();
      }, 250);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      monitor.registerProvider(mockProvider1);
    });

    it('should clear all metrics', async () => {
      await monitor.recordSuccess('provider-1', Channel.EMAIL, 100);

      monitor.clearMetrics();

      await expect(
        monitor.getProviderMetrics('provider-1', Channel.EMAIL),
      ).rejects.toThrow('No metrics found');
    });
  });
});
