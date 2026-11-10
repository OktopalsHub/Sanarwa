import { ConfigService } from "@nestjs/config";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import { CircuitBreakerService } from "../../../common/errors/services/circuit-breaker.service";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IBaseProvider } from "../../../providers/base/base-provider.interface";
import { ProviderFactory } from "../../../providers/factory/provider-factory";
import { DeliveryStatus } from "../../../providers/types";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderConfigValidator } from "../provider-config-validator";
import { ProviderConfig } from "../provider-config.entity";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { ProviderPerformanceTracker } from "../provider-performance-tracker";
import { ProviderService } from "../provider.service";
import type { Mock, Mocked } from "vitest";

describe("ProviderService", () => {
  let service: ProviderService;
  let providerConfigRepository: Mocked<Repository<ProviderConfig>>;
  let providerFactory: Mocked<ProviderFactory>;
  let performanceTracker: Mocked<ProviderPerformanceTracker>;
  let configValidator: Mocked<ProviderConfigValidator>;
  let encryptionService: Mocked<ProviderEncryptionService>;
  let configService: Mocked<ConfigService>;

  const mockProvider: Mocked<IBaseProvider> = {
    id: "test-provider",
    name: "Test Provider",
    channel: NotificationChannel.EMAIL,
    config: {
      id: "config-1",
      name: "Test Config",
      channel: NotificationChannel.EMAIL,
      priority: 1,
      isActive: true,
      credentials: {},
    },
    isInitialized: true,
    send: vi.fn(),
    validateConfig: vi.fn(),
    initialize: vi.fn(),
    destroy: vi.fn(),
  };

  const mockProviderConfig: ProviderConfig = {
    id: "config-1",
    tenantId: "tenant-1",
    providerId: "aws_ses",
    providerName: "AWS SES",
    providerType: "aws_ses" as any,
    channel: NotificationChannel.EMAIL,
    config: { accessKeyId: "encrypted", secretAccessKey: "encrypted" },
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
          provide: getRedisConnectionToken(),
          useValue: {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue("OK"),
            del: vi.fn().mockResolvedValue(0),
            sadd: vi.fn().mockResolvedValue(1),
            smembers: vi.fn().mockResolvedValue([]),
            srem: vi.fn().mockResolvedValue(1),
          },
        },
        {
          provide: CircuitBreakerService,
          useClass: CircuitBreakerService,
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
            get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<ProviderService>(ProviderService);
    providerConfigRepository = module.get(getRepositoryToken(ProviderConfig));
    providerFactory = module.get(ProviderFactory);
    performanceTracker = module.get(ProviderPerformanceTracker);
    configValidator = module.get(ProviderConfigValidator);
    encryptionService = module.get(ProviderEncryptionService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("send", () => {
    const payload = {
      recipient: "test@example.com",
      data: { message: "Hello World" },
    };

    const options = {
      tenantId: "tenant-1",
      channel: NotificationChannel.EMAIL,
    };

    it("should send notification successfully with first provider", async () => {
      const mockResponse = {
        messageId: "msg-123",
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
      };

      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: "decrypted-key",
        secretAccessKey: "decrypted-secret",
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: "aws_ses",
        channel: NotificationChannel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.send.mockResolvedValue(mockResponse);

      const result = await service.send(payload, options);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.providerId).toBe("aws_ses");
      expect(performanceTracker.recordSuccess).toHaveBeenCalled();
    });

    it("should failover to next provider when first provider fails", async () => {
      const mockProviderConfig2 = {
        ...mockProviderConfig,
        id: "config-2",
        providerId: "sendgrid",
        priority: 2,
      };

      const mockResponse = {
        messageId: "msg-456",
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
      };

      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig, mockProviderConfig2]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: "decrypted-key",
        secretAccessKey: "decrypted-secret",
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: "aws_ses",
        channel: NotificationChannel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      const mockProvider2 = { ...mockProvider, id: "sendgrid" };
      providerFactory.createProvider
        .mockResolvedValueOnce(mockProvider)
        .mockResolvedValueOnce(mockProvider2);

      mockProvider.send.mockRejectedValueOnce(new Error("Provider failed"));
      mockProvider2.send.mockResolvedValueOnce(mockResponse);

      const result = await service.send(payload, options);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.providerId).toBe("sendgrid");
      expect(performanceTracker.recordFailure).toHaveBeenCalled();
    });

    it("should throw error when all providers fail", async () => {
      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: "decrypted-key",
        secretAccessKey: "decrypted-secret",
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: "aws_ses",
        channel: NotificationChannel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      });

      providerFactory.createProvider.mockResolvedValue(mockProvider);
      mockProvider.send.mockRejectedValue(new Error("All providers failed"));

      await expect(service.send(payload, options)).rejects.toThrow(
        "All providers failed. Last error: All providers failed",
      );

      expect(performanceTracker.recordFailure).toHaveBeenCalled();
    });

    it("should throw error when no providers available", async () => {
      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await expect(service.send(payload, options)).rejects.toThrow(
        "No available providers for channel email",
      );
    });
  });

  describe("sendBulk", () => {
    it("should process bulk notifications in batches", async () => {
      const payloads = Array.from({ length: 250 }, (_, i) => ({
        recipient: `test${i}@example.com`,
        data: { message: `Hello ${i}` },
      }));

      const options = {
        tenantId: "tenant-1",
        channel: NotificationChannel.EMAIL,
      };

      configService.get.mockReturnValue(100);

      vi.spyOn(service, "send").mockResolvedValue({
        success: true,
        response: {
          messageId: "msg-123",
          status: DeliveryStatus.SENT,
          timestamp: new Date(),
        },
        providerId: "aws_ses",
        responseTime: 100,
      });

      const results = await service.sendBulk(payloads, options);

      expect(results).toHaveLength(250);
      expect(results.every((r) => r.success)).toBe(true);
      expect(service.send).toHaveBeenCalledTimes(250);
    });
  });

  describe("selectProviders", () => {
    it("should select providers based on options", async () => {
      const options = {
        tenantId: "tenant-1",
        channel: NotificationChannel.EMAIL,
        country: "US",
      };

      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockProviderConfig]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === "PROVIDER_MIN_SUCCESS_RATE") return 80;
        if (key === "CIRCUIT_BREAKER_FAILURE_THRESHOLD") return 5;
        return defaultValue;
      });

      encryptionService.decrypt.mockResolvedValue({
        accessKeyId: "decrypted-key",
        secretAccessKey: "decrypted-secret",
      });

      performanceTracker.getMetrics.mockResolvedValue({
        providerId: "aws_ses",
        channel: NotificationChannel.EMAIL,
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
      expect(providers[0].providerId).toBe("aws_ses");
      expect(queryBuilder.innerJoin).toHaveBeenCalledWith("provider.project", "project");
      expect(queryBuilder.where).toHaveBeenCalledWith("project.tenantId = :tenantId", {
        tenantId: "tenant-1",
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith("provider.channel = :channel", {
        channel: NotificationChannel.EMAIL,
      });
    });

    it("should exclude specified providers", async () => {
      const options = {
        tenantId: "tenant-1",
        channel: NotificationChannel.EMAIL,
        excludeProviders: ["aws_ses"],
      };

      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      providerConfigRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const providers = await service.selectProviders(options);

      expect(providers).toHaveLength(0);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "provider.providerId NOT IN (:...excludeProviders)",
        { excludeProviders: ["aws_ses"] },
      );
    });
  });

  describe("validateProviderConfig", () => {
    it("should validate provider configuration successfully", async () => {
      configValidator.validate.mockResolvedValue(true);

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(true);
      expect(configValidator.validate).toHaveBeenCalledWith(mockProviderConfig);
    });

    it("should return false for invalid configuration", async () => {
      configValidator.validate.mockResolvedValue(false);

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(false);
      expect(configValidator.validate).toHaveBeenCalledWith(mockProviderConfig);
    });

    it("should return false when validation throws", async () => {
      configValidator.validate.mockRejectedValue(new Error("validation blew up"));

      const isValid = await service.validateProviderConfig(mockProviderConfig);

      expect(isValid).toBe(false);
    });
  });

  describe("updateProviderConfig", () => {
    it("should update provider configuration", async () => {
      const updates = {
        priority: 2,
        isActive: false,
        config: { newField: "newValue" },
      };

      providerConfigRepository.findOne.mockResolvedValue(mockProviderConfig);
      encryptionService.encrypt.mockResolvedValue({ newField: "encrypted" });
      providerConfigRepository.save.mockResolvedValue({
        ...mockProviderConfig,
        ...updates,
        config: { newField: "encrypted" },
      });

      const result = await service.updateProviderConfig(
        "tenant-1",
        "aws_ses",
        NotificationChannel.EMAIL,
        updates,
      );

      expect(result.priority).toBe(2);
      expect(result.isActive).toBe(false);
      expect(encryptionService.encrypt).toHaveBeenCalledWith(updates.config);
    });

    it("should throw error when provider config not found", async () => {
      providerConfigRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProviderConfig("tenant-1", "aws_ses", NotificationChannel.EMAIL, {}),
      ).rejects.toThrow("Provider configuration not found: aws_ses for email");
    });
  });

  describe("toggleProvider", () => {
    it("should enable/disable provider", async () => {
      providerConfigRepository.find.mockResolvedValue([mockProviderConfig]);
      providerConfigRepository.save.mockResolvedValue({ ...mockProviderConfig, isActive: false });

      await service.toggleProvider("tenant-1", "aws_ses", NotificationChannel.EMAIL, false);

      expect(providerConfigRepository.find).toHaveBeenCalledWith({
        where: {
          project: { tenant: { id: "tenant-1" } },
          providerId: "aws_ses",
          channel: NotificationChannel.EMAIL,
        },
        relations: {
          project: {
            tenant: true,
          },
        },
      });
      expect(providerConfigRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe("getAvailableProviders", () => {
    it("should return available providers for tenant and channel", async () => {
      providerConfigRepository.find.mockResolvedValue([mockProviderConfig]);

      const providers = await service.getAvailableProviders("tenant-1", NotificationChannel.EMAIL);

      expect(providers).toHaveLength(1);
      expect(providers[0]).toEqual(mockProviderConfig);
      expect(providerConfigRepository.find).toHaveBeenCalledWith({
        where: {
          project: { tenant: { id: "tenant-1" } },
          channel: NotificationChannel.EMAIL,
          isActive: true,
        },
        relations: {
          project: {
            tenant: true,
          },
        },
        order: {
          priority: "ASC",
          createdAt: "ASC",
        },
      });
    });
  });

  describe("getProviderMetrics", () => {
    it("should return provider performance metrics", async () => {
      const metrics = {
        providerId: "aws_ses",
        channel: NotificationChannel.EMAIL,
        successRate: 95,
        averageResponseTime: 100,
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        requestsPerMinute: 10,
        errorRate: 5,
      };

      performanceTracker.getMetrics.mockResolvedValue(metrics);

      const result = await service.getProviderMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(result).toEqual(metrics);
      expect(performanceTracker.getMetrics).toHaveBeenCalledWith(
        "aws_ses",
        NotificationChannel.EMAIL,
      );
    });
  });
});
