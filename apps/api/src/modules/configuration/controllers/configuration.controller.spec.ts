import { Test, TestingModule } from "@nestjs/testing";
import { UserRole } from "../../modules/auth/enums/user-role.enum";
import type { Mocked } from "vitest";
import {
  CreateConfigurationDto,
  RollbackConfigurationDto,
  UpdateConfigurationDto,
} from "../dto/configuration.dto";
import { ConfigurationVersion, VersionAction } from "../entities/configuration-version.entity";
import {
  Configuration,
  ConfigurationScope,
  ConfigurationStatus,
} from "../entities/configuration.entity";
import { ConfigurationCacheService } from "../services/configuration-cache.service";
import { ConfigurationValidationService } from "../services/configuration-validation.service";
import { ConfigurationWatcherService } from "../services/configuration-watcher.service";
import { ConfigurationService } from "../services/configuration.service";
import { ConfigurationController } from "./configuration.controller";

describe("ConfigurationController", () => {
  let controller: ConfigurationController;
  let configurationService: Mocked<ConfigurationService>;
  let validationService: Mocked<ConfigurationValidationService>;
  let cacheService: Mocked<ConfigurationCacheService>;
  let watcherService: Mocked<ConfigurationWatcherService>;

  const mockConfiguration: Configuration = {
    id: "test-id",
    key: "test.key",
    value: "test-value",
    scope: ConfigurationScope.GLOBAL,
    environment: "test",
    status: ConfigurationStatus.ACTIVE,
    isEncrypted: false,
    isSecret: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Configuration;

  const mockUser = {
    id: "user-id",
    role: UserRole.ADMIN,
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const mockConfigurationService = {
      create: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      rollback: vi.fn(),
      getVersions: vi.fn(),
      bulkOperation: vi.fn(),
    };

    const mockValidationService = {
      validateValue: vi.fn(),
      getAvailableSchemas: vi.fn(),
    };

    const mockCacheService = {
      getStats: vi.fn(),
      clear: vi.fn(),
      healthCheck: vi.fn(),
    };

    const mockWatcherService = {
      getStatus: vi.fn(),
      reload: vi.fn(),
      forceCheck: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigurationController],
      providers: [
        {
          provide: ConfigurationService,
          useValue: mockConfigurationService,
        },
        {
          provide: ConfigurationValidationService,
          useValue: mockValidationService,
        },
        {
          provide: ConfigurationCacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigurationWatcherService,
          useValue: mockWatcherService,
        },
      ],
    }).compile();

    controller = module.get<ConfigurationController>(ConfigurationController);
    configurationService = module.get(ConfigurationService);
    validationService = module.get(ConfigurationValidationService);
    cacheService = module.get(ConfigurationCacheService);
    watcherService = module.get(ConfigurationWatcherService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    const createDto: CreateConfigurationDto = {
      key: "test.key",
      value: "test-value",
      scope: ConfigurationScope.GLOBAL,
      environment: "test",
    };

    it("should create configuration successfully", async () => {
      const result = {
        configuration: mockConfiguration,
        validationResult: { isValid: true },
      };
      configurationService.create.mockResolvedValue(result);

      const response = await controller.create(createDto, mockRequest);

      expect(response.success).toBe(true);
      expect(response.configuration).toEqual(mockConfiguration);
      expect(configurationService.create).toHaveBeenCalledWith(createDto, "user-id");
    });

    it("should return validation errors", async () => {
      const result = {
        configuration: mockConfiguration,
        validationResult: { isValid: false, errors: ["Invalid value"] },
      };
      configurationService.create.mockResolvedValue(result);

      const response = await controller.create(createDto, mockRequest);

      expect(response.success).toBe(false);
      expect(response.errors).toEqual(["Invalid value"]);
      expect(response.configuration).toBeNull();
    });
  });

  describe("findAll", () => {
    it("should return all configurations", async () => {
      const configurations = [mockConfiguration];
      configurationService.find.mockResolvedValue(configurations);

      const response = await controller.findAll({});

      expect(response.success).toBe(true);
      expect(response.data).toEqual(configurations);
      expect(response.count).toBe(1);
    });
  });

  describe("findOne", () => {
    it("should return configuration by ID", async () => {
      configurationService.findById.mockResolvedValue(mockConfiguration);

      const response = await controller.findOne("test-id");

      expect(response.success).toBe(true);
      expect(response.configuration).toEqual(mockConfiguration);
      expect(configurationService.findById).toHaveBeenCalledWith("test-id", undefined);
    });

    it("should include secrets when requested", async () => {
      configurationService.findById.mockResolvedValue(mockConfiguration);

      await controller.findOne("test-id", true);

      expect(configurationService.findById).toHaveBeenCalledWith("test-id", true);
    });
  });

  describe("update", () => {
    const updateDto: UpdateConfigurationDto = {
      value: "updated-value",
    };

    it("should update configuration successfully", async () => {
      const result = {
        configuration: { ...mockConfiguration, value: "updated-value" },
        validationResult: { isValid: true },
      };
      configurationService.update.mockResolvedValue(result);

      const response = await controller.update("test-id", updateDto, mockRequest);

      expect(response.success).toBe(true);
      expect(response.configuration.value).toBe("updated-value");
      expect(configurationService.update).toHaveBeenCalledWith("test-id", updateDto, "user-id");
    });

    it("should return validation errors", async () => {
      const result = {
        configuration: mockConfiguration,
        validationResult: { isValid: false, errors: ["Invalid value"] },
      };
      configurationService.update.mockResolvedValue(result);

      const response = await controller.update("test-id", updateDto, mockRequest);

      expect(response.success).toBe(false);
      expect(response.errors).toEqual(["Invalid value"]);
    });
  });

  describe("remove", () => {
    it("should delete configuration successfully", async () => {
      configurationService.delete.mockResolvedValue();

      const response = await controller.remove("test-id", mockRequest);

      expect(response.success).toBe(true);
      expect(response.message).toBe("Configuration deleted successfully");
      expect(configurationService.delete).toHaveBeenCalledWith("test-id", "user-id");
    });
  });

  describe("rollback", () => {
    const rollbackDto: RollbackConfigurationDto = {
      versionId: "version-id",
      reason: "Test rollback",
    };

    it("should rollback configuration successfully", async () => {
      const rolledBackConfig = {
        ...mockConfiguration,
        value: "previous-value",
      };
      configurationService.rollback.mockResolvedValue(rolledBackConfig);

      const response = await controller.rollback("test-id", rollbackDto, mockRequest);

      expect(response.success).toBe(true);
      expect(response.configuration).toEqual(rolledBackConfig);
      expect(response.message).toBe("Configuration rolled back successfully");
      expect(configurationService.rollback).toHaveBeenCalledWith("test-id", rollbackDto, "user-id");
    });
  });

  describe("getVersions", () => {
    it("should return configuration versions", async () => {
      const versions: ConfigurationVersion[] = [
        {
          id: "version-id",
          configurationId: "test-id",
          version: 1,
          newValue: "test-value",
          action: VersionAction.CREATE,
          createdAt: new Date(),
        } as ConfigurationVersion,
      ];
      configurationService.getVersions.mockResolvedValue(versions);

      const response = await controller.getVersions("test-id");

      expect(response.success).toBe(true);
      expect(response.versions).toEqual(versions);
      expect(response.count).toBe(1);
    });
  });

  describe("bulkOperation", () => {
    const bulkDto = {
      configurations: [
        {
          key: "bulk.key1",
          value: "value1",
          scope: ConfigurationScope.GLOBAL,
        },
        {
          key: "bulk.key2",
          value: "value2",
          scope: ConfigurationScope.GLOBAL,
        },
      ],
      validateAll: true,
    };

    it("should process bulk operations successfully", async () => {
      const bulkResult = {
        successful: [
          {
            configuration: mockConfiguration,
            validationResult: { isValid: true },
          },
          {
            configuration: mockConfiguration,
            validationResult: { isValid: true },
          },
        ],
        failed: [],
      };
      configurationService.bulkOperation.mockResolvedValue(bulkResult);

      const response = await controller.bulkOperation(bulkDto, mockRequest);

      expect(response.success).toBe(true);
      expect(response.summary.total).toBe(2);
      expect(response.summary.successful).toBe(2);
      expect(response.summary.failed).toBe(0);
    });
  });

  describe("getValidationSchemas", () => {
    it("should return available validation schemas", async () => {
      const schemas = ["string", "number", "email"];
      validationService.getAvailableSchemas.mockReturnValue(schemas);

      const response = await controller.getValidationSchemas();

      expect(response.success).toBe(true);
      expect(response.schemas).toEqual(schemas);
    });
  });

  describe("testValidation", () => {
    it("should test configuration validation", async () => {
      const validationResult = { isValid: true };
      validationService.validateValue.mockResolvedValue(validationResult);

      const response = await controller.testValidation({
        value: "test-value",
        schema: "string",
      });

      expect(response.success).toBe(true);
      expect(response.validation).toEqual(validationResult);
      expect(validationService.validateValue).toHaveBeenCalledWith("test-value", "string");
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      const stats = { totalKeys: 10, memoryUsage: "1MB" };
      cacheService.getStats.mockResolvedValue(stats);

      const response = await controller.getCacheStats();

      expect(response.success).toBe(true);
      expect(response.cache).toEqual(stats);
    });
  });

  describe("clearCache", () => {
    it("should clear configuration cache", async () => {
      cacheService.clear.mockResolvedValue();

      const response = await controller.clearCache();

      expect(response.success).toBe(true);
      expect(response.message).toBe("Configuration cache cleared successfully");
      expect(cacheService.clear).toHaveBeenCalled();
    });
  });

  describe("getWatcherStatus", () => {
    it("should return watcher status", async () => {
      const status = {
        isWatching: true,
        watchedCount: 5,
        lastCheck: new Date(),
        pollInterval: 30000,
        watchPatterns: ["*"],
      };
      watcherService.getStatus.mockReturnValue(status);

      const response = await controller.getWatcherStatus();

      expect(response.success).toBe(true);
      expect(response.watcher).toEqual(status);
    });
  });

  describe("reloadWatcher", () => {
    it("should reload watched configurations", async () => {
      watcherService.reload.mockResolvedValue();

      const response = await controller.reloadWatcher();

      expect(response.success).toBe(true);
      expect(response.message).toBe("Watched configurations reloaded successfully");
      expect(watcherService.reload).toHaveBeenCalled();
    });
  });

  describe("forceCheck", () => {
    it("should force check for configuration changes", async () => {
      const changes = [
        {
          key: "test.key",
          scope: ConfigurationScope.GLOBAL,
          environment: "test",
          newValue: "new-value",
          action: "update" as const,
          timestamp: new Date(),
        },
      ];
      watcherService.forceCheck.mockResolvedValue(changes);

      const response = await controller.forceCheck();

      expect(response.success).toBe(true);
      expect(response.changes).toEqual(changes);
      expect(response.count).toBe(1);
    });
  });

  describe("healthCheck", () => {
    it("should return health status", async () => {
      const cacheHealth = { status: "healthy" as const };
      const watcherStatus = {
        isWatching: true,
        watchedCount: 5,
        lastCheck: new Date(),
        pollInterval: 30000,
        watchPatterns: ["*"],
      };

      cacheService.healthCheck.mockResolvedValue(cacheHealth);
      watcherService.getStatus.mockReturnValue(watcherStatus);

      const response = await controller.healthCheck();

      expect(response.success).toBe(true);
      expect(response.health.cache).toEqual(cacheHealth);
      expect(response.health.watcher.status).toBe("healthy");
      expect(response.health.watcher.watchedCount).toBe(5);
      expect(response.health.timestamp).toBeInstanceOf(Date);
    });

    it("should return inactive watcher status when not watching", async () => {
      const cacheHealth = { status: "healthy" as const };
      const watcherStatus = {
        isWatching: false,
        watchedCount: 0,
        lastCheck: new Date(),
        pollInterval: 30000,
        watchPatterns: ["*"],
      };

      cacheService.healthCheck.mockResolvedValue(cacheHealth);
      watcherService.getStatus.mockReturnValue(watcherStatus);

      const response = await controller.healthCheck();

      expect(response.health.watcher.status).toBe("inactive");
    });
  });
});
