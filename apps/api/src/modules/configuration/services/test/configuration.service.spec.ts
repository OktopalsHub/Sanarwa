import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EncryptionService } from "../../../common/security/services/encryption.service";
import type { Mocked } from "vitest";
import {
  CreateConfigurationDto,
  RollbackConfigurationDto,
  UpdateConfigurationDto,
} from "../../dto/configuration.dto";
import { ConfigurationVersion, VersionAction } from "../../entities/configuration-version.entity";
import {
  Configuration,
  ConfigurationScope,
  ConfigurationStatus,
} from "../../entities/configuration.entity";
import { ConfigurationValidationService } from "../configuration-validation.service";
import { ConfigurationService } from "../configuration.service";

describe("ConfigurationService", () => {
  let service: ConfigurationService;
  let configRepository: Mocked<Repository<Configuration>>;
  let versionRepository: Mocked<Repository<ConfigurationVersion>>;
  let encryptionService: Mocked<EncryptionService>;
  let validationService: Mocked<ConfigurationValidationService>;
  let configService: Mocked<ConfigService>;

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

  const mockEncryptionResult = {
    encryptedData: "encrypted-data",
    iv: "test-iv",
    tag: "test-tag",
    algorithm: "aes-256-gcm",
    keyVersion: "v1",
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
      getMany: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
    };

    const mockConfigRepository = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(() => mockQueryBuilder),
    };

    const mockVersionRepository = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
    };

    const mockEncryptionService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    };

    const mockValidationService = {
      validateValue: vi.fn(),
      validateConfigurations: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationService,
        {
          provide: getRepositoryToken(Configuration),
          useValue: mockConfigRepository,
        },
        {
          provide: getRepositoryToken(ConfigurationVersion),
          useValue: mockVersionRepository,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: ConfigurationValidationService,
          useValue: mockValidationService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
    configRepository = module.get(getRepositoryToken(Configuration));
    versionRepository = module.get(getRepositoryToken(ConfigurationVersion));
    encryptionService = module.get(EncryptionService);
    validationService = module.get(ConfigurationValidationService);
    configService = module.get(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const createDto: CreateConfigurationDto = {
      key: "test.key",
      value: "test-value",
      scope: ConfigurationScope.GLOBAL,
      environment: "test",
    };

    it("should create a configuration successfully", async () => {
      validationService.validateValue.mockResolvedValue({ isValid: true });
      mockQueryBuilder.getOne.mockResolvedValue(null);
      configRepository.create.mockReturnValue(mockConfiguration);
      configRepository.save.mockResolvedValue(mockConfiguration);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);

      const result = await service.create(createDto, "user-id");

      expect(result.configuration).toEqual(mockConfiguration);
      expect(result.validationResult?.isValid).toBe(true);
      expect(configRepository.save).toHaveBeenCalled();
      expect(versionRepository.save).toHaveBeenCalled();
    });

    it("should encrypt value when isSecret is true", async () => {
      const secretDto = { ...createDto, isSecret: true };
      validationService.validateValue.mockResolvedValue({ isValid: true });
      mockQueryBuilder.getOne.mockResolvedValue(null);
      encryptionService.encrypt.mockResolvedValue(mockEncryptionResult);
      configRepository.create.mockReturnValue(mockConfiguration);
      configRepository.save.mockResolvedValue(mockConfiguration);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);

      await service.create(secretDto, "user-id");

      expect(encryptionService.encrypt).toHaveBeenCalledWith("test-value");
      expect(configRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: JSON.stringify(mockEncryptionResult),
        }),
      );
    });

    it("should return validation errors when validation fails", async () => {
      const validationResult = {
        isValid: false,
        errors: ["Invalid value"],
      };
      validationService.validateValue.mockResolvedValue(validationResult);

      const result = await service.create(createDto);

      expect(result.configuration).toBeNull();
      expect(result.validationResult).toEqual(validationResult);
    });

    it("should throw error when configuration already exists", async () => {
      validationService.validateValue.mockResolvedValue({ isValid: true });
      mockQueryBuilder.getOne.mockResolvedValue(mockConfiguration);

      await expect(service.create(createDto)).rejects.toThrow(
        "Configuration with key 'test.key' already exists",
      );
    });
  });

  describe("update", () => {
    const updateDto: UpdateConfigurationDto = {
      value: "updated-value",
    };

    it("should update configuration successfully", async () => {
      validationService.validateValue.mockResolvedValue({ isValid: true });
      configRepository.findOne.mockResolvedValue(mockConfiguration);
      encryptionService.decrypt.mockResolvedValue("original-value");
      configRepository.update.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);

      const updatedConfig = { ...mockConfiguration, value: "updated-value" };
      configRepository.findOne
        .mockResolvedValueOnce(mockConfiguration)
        .mockResolvedValueOnce(updatedConfig);

      const result = await service.update("test-id", updateDto, "user-id");

      expect(result.configuration).toEqual(updatedConfig);
      expect(configRepository.update).toHaveBeenCalledWith("test-id", expect.any(Object));
    });

    it("should throw NotFoundException when configuration not found", async () => {
      configRepository.findOne.mockResolvedValue(null);

      await expect(service.update("non-existent", updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getValue", () => {
    it("should return decrypted value for encrypted configuration", async () => {
      const encryptedConfig = {
        ...mockConfiguration,
        isEncrypted: true,
        value: JSON.stringify(mockEncryptionResult),
      };

      mockQueryBuilder.getOne.mockResolvedValue(encryptedConfig);
      encryptionService.decrypt.mockResolvedValue("decrypted-value");

      const result = await service.getValue("test.key");

      expect(result).toBe("decrypted-value");
      expect(encryptionService.decrypt).toHaveBeenCalledWith(mockEncryptionResult);
    });

    it("should return plain value for non-encrypted configuration", async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockConfiguration);

      const result = await service.getValue("test.key");

      expect(result).toBe("test-value");
      expect(encryptionService.decrypt).not.toHaveBeenCalled();
    });

    it("should return null for inactive configuration", async () => {
      const inactiveConfig = {
        ...mockConfiguration,
        status: ConfigurationStatus.INACTIVE,
      };
      mockQueryBuilder.getOne.mockResolvedValue(inactiveConfig);

      const result = await service.getValue("test.key");

      expect(result).toBeNull();
    });

    it("should return null when configuration not found", async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.getValue("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("rollback", () => {
    const rollbackDto: RollbackConfigurationDto = {
      versionId: "version-id",
      reason: "Test rollback",
    };

    const mockVersion: ConfigurationVersion = {
      id: "version-id",
      configurationId: "test-id",
      version: 1,
      newValue: "previous-value",
      action: VersionAction.CREATE,
      createdAt: new Date(),
    } as ConfigurationVersion;

    it("should rollback configuration successfully", async () => {
      configRepository.findOne.mockResolvedValue(mockConfiguration);
      versionRepository.findOne.mockResolvedValue(mockVersion);
      encryptionService.decrypt.mockResolvedValue("current-value");
      encryptionService.encrypt.mockResolvedValue(mockEncryptionResult);
      configRepository.update.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);

      const rolledBackConfig = {
        ...mockConfiguration,
        value: "previous-value",
      };
      configRepository.findOne
        .mockResolvedValueOnce(mockConfiguration)
        .mockResolvedValueOnce(rolledBackConfig);

      const result = await service.rollback("test-id", rollbackDto, "user-id");

      expect(result).toEqual(rolledBackConfig);
      expect(configRepository.update).toHaveBeenCalled();
      expect(versionRepository.save).toHaveBeenCalled();
    });

    it("should throw error when version does not belong to configuration", async () => {
      const wrongVersion = { ...mockVersion, configurationId: "wrong-id" };
      configRepository.findOne.mockResolvedValue(mockConfiguration);
      versionRepository.findOne.mockResolvedValue(wrongVersion);

      await expect(service.rollback("test-id", rollbackDto)).rejects.toThrow(
        "Version does not belong to this configuration",
      );
    });
  });

  describe("delete", () => {
    it("should delete configuration successfully", async () => {
      configRepository.findOne.mockResolvedValue(mockConfiguration);
      versionRepository.find.mockResolvedValue([]);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);
      configRepository.delete.mockResolvedValue({} as any);

      await service.delete("test-id", "user-id");

      expect(configRepository.delete).toHaveBeenCalledWith("test-id");
      expect(versionRepository.save).toHaveBeenCalled();
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
      validationService.validateConfigurations.mockResolvedValue({
        "bulk.key1": { isValid: true },
        "bulk.key2": { isValid: true },
      });

      mockQueryBuilder.getOne.mockResolvedValue(null);
      configRepository.create.mockReturnValue(mockConfiguration);
      configRepository.save.mockResolvedValue(mockConfiguration);
      versionRepository.create.mockReturnValue({} as ConfigurationVersion);
      versionRepository.save.mockResolvedValue({} as ConfigurationVersion);

      const result = await service.bulkOperation(bulkDto, "user-id");

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle validation failures in bulk operation", async () => {
      validationService.validateConfigurations.mockResolvedValue({
        "bulk.key1": { isValid: false, errors: ["Invalid value"] },
        "bulk.key2": { isValid: true },
      });

      const result = await service.bulkOperation(bulkDto, "user-id");

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].error).toContain("Validation failed");
    });
  });
});
