import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IBaseProvider } from '../../providers/base/base-provider.interface';
import { ProviderFactory } from '../../providers/factory/provider-factory';
import { ProviderHealthMonitor } from '../../providers/health/provider-health-monitor';
import { Channel, DeliveryStatus, ProviderHealth } from '../../providers/types';
import { ProviderConfigValidator } from './provider-config-validator';
import { ProviderConfig } from './provider-config.entity';
import { ProviderEncryptionService } from './provider-encryption.service';
import { ProviderPerformanceTracker } from './provider-performance-tracker';
import { ProviderService } from './provider.service';
import type { Mock, Mocked } from 'vitest';

describe('ProviderService', () => {
  let service: ProviderService;
  let providerConfigRepository: Mocked<Repository<ProviderConfig>>;
  let providerFactory: Mocked<ProviderFactory>;
  let healthMonitor: Mocked<ProviderHealthMonitor>;
  let performanceTracker: Mocked<ProviderPerformanceTracker>;
  let configValidator: Mocked<ProviderConfigValidator>;
  let encryptionService: Mocked<ProviderEncryptionService>;
  let configService: Mocked<ConfigService>;

  const mockProvider: Mocked<IBaseProvider> = {
    id: 'test-provider',
    name: 'Test Provider',
    channel: Channel.EMAIL,
    config: {
      id: 'config-1',
      name: 'Test Config',
      channel: Channel.EMAIL,
      priority: 1,
      isActive: true,
      credentials: {},
    },
    isInitialized: true,
    send: vi.fn(),
    validateConfig: vi.fn(),
    checkHealth: vi.fn(),
    initialize: vi.fn(),
    destroy: vi.fn(),
  };

  const mockProviderConfig: ProviderConfig = {
    id: 'config-1',
    tenantId: 'tenant-1',
    providerId: 'aws_ses',
    providerName: 'AWS SES',
    providerType: 'aws_ses' as any,
    channel: Channel.EMAIL,
    config: { accessKeyId: 'encrypted', secretAccessKey: 'encrypted' },
    priority: 1,
    isActive: true,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderService,
        {
          provide: getRepositoryToken(ProviderConfig),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: ProviderFactory,
          useValue: {
            createProvider: vi.fn(),
          },
        },
        {
          provide: ProviderHealthMonitor,
          useValue: {
            registerProvider: vi.fn(),
            recordSuccess: vi.fn(),
            recordFailure: vi.fn(),
            checkProviderHealth: vi.fn(),
          },
        },
        {
          provide: ProviderPerformanceTracker,
          useValue: {
            recordSuccess: vi.fn(),
            recordFailure: vi.fn(),
            getMetrics: vi.fn(),
          },
        },
        {
          provide: ProviderConfigValidator,
          useValue: {
            validate: vi.fn(),
          },
        },
        {
          provide: ProviderEncryptionService,
          useValue: {
            encrypt: vi.fn(),
            decrypt: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProviderService>(ProviderService);
    providerConfigRepository = module.get(getRepositoryToken(ProviderConfig));
    providerFactory = module.get(ProviderFactory);
    healthMonitor = module.get(ProviderHealthMonitor);
    performanceTracker = module.get(ProviderPerformanceTracker);
    configValidator = module.get(ProviderConfigValidator);
    encryptionService = module.get(ProviderEncryptionService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('send', () => {
    const payload = {
      recipient: 'test@example.com',
      data: { message: 'Hello World' },
    };

    const options = {
      tenantId: 'tenant-1',
      channel: Channel.EMAIL,
    };

    it('should send notification successfully with first provider', async () => {
      const mockResponse = {
        messageId: 'msg-123',
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
      };

      // Mock provider selection
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      // Mock encryption
      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: 'decrypted-key',
        secretAccessKey: 'decrypted-secret',
      });

      // Mock performance tracker
      performanceTracker.getMetrics.mockResolvedValue({
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      // Mock provider factory and provider
      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.send.mockResolvedValue(mockResponse);

      const result = await service.send(payload, options);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.providerId).toBe('aws_ses');
      expect(healthMonitor.recordSuccess).toHaveBeenCalled();
      expect(performanceTracker.recordSuccess).toHaveBeenCalled();
    });

    it('should failover to next provider when first provider fails', async () => {
      const mockProviderConfig2 = {
        ...mockProviderConfig,
        id: 'config-2',
        providerId: 'sendgrid',
        priority: 2,
      };

      const mockResponse = {
        messageId: 'msg-456',
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
      };

      // Mock provider selection returning two providers
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi
          .fn()
          .mockResolvedValue([mockProviderConfig, mockProviderConfig2]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: 'decrypted-key',
        secretAccessKey: 'decrypted-secret',
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      // First provider fails, second succeeds
      const mockProvider2 = { ...mockProvider, id: 'sendgrid' };
      providerFactory.createProvider
        .mockResolvedValueOnce(mockProvider)
        .mockResolvedValueOnce(mockProvider2);

      mockProvider.send.mockRejectedValueOnce(new Error('Provider failed'));
      mockProvider2.send.mockResolvedValueOnce(mockResponse);

      const result = await service.send(payload, options);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.providerId).toBe('sendgrid');
      expect(healthMonitor.recordFailure).toHaveBeenCalledWith(
        'aws_ses',
        Channel.EMAIL,
        'Provider failed',
      );
      expect(healthMonitor.recordSuccess).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: 'decrypted-key',
        secretAccessKey: 'decrypted-secret',
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.send.mockRejectedValue(new Error('All providers failed'));

      await expect(service.send(payload, options)).rejects.toThrow(
        'All providers failed. Last error: All providers failed',
      );

      expect(healthMonitor.recordFailure).toHaveBeenCalled();
    });

    it('should throw error when no providers available', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      await expect(service.send(payload, options)).rejects.toThrow(
        'No available providers for channel email',
      );
    });
  });

  describe('sendBulk', () => {
    it('should process bulk notifications in batches', async () => {
      const payloads = Array.from({ length: 250 }, (_, i) => ({
        recipient: `test${i}@example.com`,
        data: { message: `Hello ${i}` },
      }));

      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
      };

      configService.get.mockReturnValue(100); // Batch size

      // Mock successful send for all
      vi.spyOn(service, 'send').mockResolvedValue({
        success: true,
        response: {
          messageId: 'msg-123',
          status: DeliveryStatus.SENT,
          timestamp: new Date(),
        },
        providerId: 'aws_ses',
        responseTime: 100,
      });

      const results = await service.sendBulk(payloads, options);

      expect(results).toHaveLength(250);
      expect(results.every((r) => r.success)).toBe(true);
      expect(service.send).toHaveBeenCalledTimes(250);
    });
  });

  describe('selectProviders', () => {
    it('should select providers based on options', async () => {
      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
        country: 'US',
      };

      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: 'decrypted-key',
        secretAccessKey: 'decrypted-secret',
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      const providers = await service.selectProviders(options);

      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('aws_ses');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'provider.tenantId = :tenantId',
        { tenantId: 'tenant-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'provider.channel = :channel',
        { channel: Channel.EMAIL },
      );
    });

    it('should exclude specified providers', async () => {
      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
        excludeProviders: ['aws_ses'],
      };

      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      const providers = await service.selectProviders(options);

      expect(providers).toHaveLength(0);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'provider.providerId NOT IN (:...excludeProviders)',
        { excludeProviders: ['aws_ses'] },
      );
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate provider configuration successfully', async () => {
      configValidator.validate.mockResolvedValue(true);
      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.checkHealth.mockResolvedValue({
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
      });

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(true);
      expect(configValidator.validate).toHaveBeenCalledWith(mockProviderConfig);
      expect(mockProvider.checkHealth).toHaveBeenCalled();
    });

    it('should return false for invalid configuration', async () => {
      configValidator.validate.mockResolvedValue(false);

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(false);
      expect(configValidator.validate).toHaveBeenCalledWith(mockProviderConfig);
    });

    it('should return false when provider health check fails', async () => {
      configValidator.validate.mockResolvedValue(true);
      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.checkHealth.mockResolvedValue({
        status: ProviderHealth.UNHEALTHY,
        lastChecked: new Date(),
      });

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(false);
    });
  });

  describe('updateProviderConfig', () => {
    it('should update provider configuration', async () => {
      const updates = {
        priority: 2,
        isActive: false,
        config: { newField: 'newValue' },
      };

      providerConfigRepository.findOne.mockResolvedValue(mockProviderConfig);
      encryptionService.encrypt.mockResolvedValue({ newField: 'encrypted' });
      providerConfigRepository.save.mockResolvedValue({
        ...mockProviderConfig,
        ...updates,
        config: { newField: 'encrypted' },
      });

      const result = await service.updateProviderConfig(
        'tenant-1',
        'aws_ses',
        Channel.EMAIL,
        updates,
      );

      expect(result.priority).toBe(2);
      expect(result.isActive).toBe(false);
      expect(encryptionService.encrypt).toHaveBeenCalledWith(updates.config);
    });

    it('should throw error when provider config not found', async () => {
      providerConfigRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProviderConfig('tenant-1', 'aws_ses', Channel.EMAIL, {}),
      ).rejects.toThrow('Provider configuration not found: aws_ses for email');
    });
  });

  describe('toggleProvider', () => {
    it('should enable/disable provider', async () => {
      await service.toggleProvider('tenant-1', 'aws_ses', Channel.EMAIL, false);

      expect(providerConfigRepository.update).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', providerId: 'aws_ses', channel: Channel.EMAIL },
        { isActive: false },
      );
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers for tenant and channel', async () => {
      providerConfigRepository.find.mockResolvedValue([mockProviderConfig]);

      const providers = await service.getAvailableProviders(
        'tenant-1',
        Channel.EMAIL,
      );

      expect(providers).toHaveLength(1);
      expect(providers[0]).toEqual(mockProviderConfig);
      expect(providerConfigRepository.find).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          channel: Channel.EMAIL,
          isActive: true,
        },
        order: {
          priority: 'ASC',
          createdAt: 'ASC',
        },
      });
    });
  });

  describe('getProviderHealth', () => {
    it('should return provider health status', async () => {
      const healthResult = {
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        isHealthy: true,
        status: { status: ProviderHealth.HEALTHY, lastChecked: new Date() },
        metrics: {},
      };

      healthMonitor.checkProviderHealth.mockResolvedValue(healthResult);

      const result = await service.getProviderHealth('aws_ses', Channel.EMAIL);

      expect(result).toEqual(healthResult);
      expect(healthMonitor.checkProviderHealth).toHaveBeenCalledWith(
        'aws_ses',
        Channel.EMAIL,
      );
    });
  });

  describe('getProviderMetrics', () => {
    it('should return provider performance metrics', async () => {
      const metrics = {
        providerId: 'aws_ses',
        channel: Channel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      };

      performanceTracker.getMetrics.mockResolvedValue(metrics);

      const result = await service.getProviderMetrics('aws_ses', Channel.EMAIL);

      expect(result).toEqual(metrics);
      expect(performanceTracker.getMetrics).toHaveBeenCalledWith(
        'aws_ses',
        Channel.EMAIL,
      );
    });
  });
});
