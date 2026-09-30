import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Mock, Mocked } from "vitest";
import { Repository } from "typeorm";
import { Configuration, ConfigurationScope } from "../../entities/configuration.entity";
import { ConfigurationCacheService } from "../configuration-cache.service";
import { ConfigurationWatcherService } from "../configuration-watcher.service";

describe("ConfigurationWatcherService", () => {
  let service: ConfigurationWatcherService;
  let configRepository: Mocked<Repository<Configuration>>;
  let cacheService: Mocked<ConfigurationCacheService>;
  let eventEmitter: Mocked<EventEmitter2>;
  let configService: Mocked<ConfigService>;

  const mockConfiguration: Configuration = {
    id: "test-id",
    key: "test.key",
    value: "test-value",
    scope: ConfigurationScope.GLOBAL,
    environment: "test",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Configuration;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      setParameter: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
    };

    const mockConfigRepository = {
      createQueryBuilder: vi.fn(() => mockQueryBuilder),
      find: vi.fn(),
    };

    const mockCacheService = {
      invalidate: vi.fn(),
      clear: vi.fn(),
    };

    const mockEventEmitter = {
      emit: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          CONFIG_WATCH_INTERVAL: 30000,
          CONFIG_HOT_RELOAD_ENABLED: true,
          CONFIG_WATCH_PATTERNS: "*",
          NODE_ENV: "test",
        };
        return values[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationWatcherService,
        {
          provide: getRepositoryToken(Configuration),
          useValue: mockConfigRepository,
        },
        {
          provide: ConfigurationCacheService,
          useValue: mockCacheService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ConfigurationWatcherService>(ConfigurationWatcherService);
    configRepository = module.get(getRepositoryToken(Configuration));
    cacheService = module.get(ConfigurationCacheService);
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);

    // Clear any existing intervals
    await service.onModuleDestroy();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should start watching when hot reload is enabled", async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockConfiguration]);

      await service.onModuleInit();

      const status = service.getStatus();
      expect(status.isWatching).toBe(true);
    });

    it("should not start watching when hot reload is disabled", async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === "CONFIG_HOT_RELOAD_ENABLED") return false;
        return defaultValue;
      });

      await service.onModuleInit();

      const status = service.getStatus();
      expect(status.isWatching).toBe(false);
    });
  });

  describe("startWatching", () => {
    it("should start watching successfully", async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockConfiguration]);

      await service.startWatching();

      const status = service.getStatus();
      expect(status.isWatching).toBe(true);
      expect(status.watchedCount).toBe(1);
    });

    it("should not start if already watching", async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockConfiguration]);

      await service.startWatching();
      await service.startWatching(); // Second call should be ignored

      const status = service.getStatus();
      expect(status.isWatching).toBe(true);
    });
  });

  describe("stopWatching", () => {
    it("should stop watching successfully", async () => {
      configRepository.createQueryBuilder().getMany.mockResolvedValue([mockConfiguration]);

      await service.startWatching();
      await service.stopWatching();

      const status = service.getStatus();
      expect(status.isWatching).toBe(false);
      expect(status.watchedCount).toBe(0);
    });

    it("should handle stop when not watching", async () => {
      await service.stopWatching();

      const status = service.getStatus();
      expect(status.isWatching).toBe(false);
    });
  });

  describe("watchConfiguration", () => {
    it("should add configuration to watch list", async () => {
      configRepository.find.mockResolvedValue([mockConfiguration]);

      await service.watchConfiguration("test.key");

      const watchedKeys = service.getWatchedConfigurations();
      expect(watchedKeys).toContain("test.key:global");
    });

    it("should handle non-existent configuration", async () => {
      configRepository.find.mockResolvedValue([]);

      await service.watchConfiguration("non-existent");

      const watchedKeys = service.getWatchedConfigurations();
      expect(watchedKeys).not.toContain("non-existent:global");
    });
  });

  describe("unwatchConfiguration", () => {
    it("should remove configuration from watch list", async () => {
      configRepository.find.mockResolvedValue([mockConfiguration]);

      await service.watchConfiguration("test.key");
      service.unwatchConfiguration("test.key");

      const watchedKeys = service.getWatchedConfigurations();
      expect(watchedKeys).not.toContain("test.key:global");
    });
  });

  describe("forceCheck", () => {
    it("should check for changes and return results", async () => {
      const updatedConfig = {
        ...mockConfiguration,
        value: "updated-value",
        updatedAt: new Date(Date.now() + 1000),
      };

      mockQueryBuilder.getMany
        .mockResolvedValueOnce([mockConfiguration]) // Initial load
        .mockResolvedValueOnce([updatedConfig]); // Force check

      await service.startWatching();

      // Simulate configuration being watched
      (service as any).watchedConfigurations.set("test.key:global:test", mockConfiguration);

      const changes = await service.forceCheck();

      expect(changes).toHaveLength(1);
      expect(changes[0].action).toBe("update");
      expect(changes[0].newValue).toBe("updated-value");
      expect(cacheService.invalidate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith("configuration.changed", expect.any(Object));
    });

    it("should detect new configurations", async () => {
      const newConfig = {
        ...mockConfiguration,
        key: "new.key",
        createdAt: new Date(),
      };

      mockQueryBuilder.getMany
        .mockResolvedValueOnce([]) // Initial load (empty)
        .mockResolvedValueOnce([newConfig]); // Force check with new config

      await service.startWatching();

      const changes = await service.forceCheck();

      expect(changes).toHaveLength(1);
      expect(changes[0].action).toBe("create");
      expect(eventEmitter.emit).toHaveBeenCalledWith("configuration.created", expect.any(Object));
    });

    it("should handle errors gracefully", async () => {
      mockQueryBuilder.getMany
        .mockResolvedValueOnce([mockConfiguration])
        .mockRejectedValueOnce(new Error("Database error"));

      await service.startWatching();

      const changes = await service.forceCheck();

      expect(changes).toHaveLength(0);
    });
  });

  describe("reload", () => {
    it("should reload watched configurations", async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockConfiguration]);

      await service.reload();

      expect(cacheService.clear).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith("configuration.reloaded", expect.any(Object));
    });
  });

  describe("getStatus", () => {
    it("should return correct status information", async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockConfiguration]);

      await service.startWatching();

      const status = service.getStatus();

      expect(status.isWatching).toBe(true);
      expect(status.watchedCount).toBe(1);
      expect(status.pollInterval).toBe(30000);
      expect(status.watchPatterns).toEqual(["*"]);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe("pattern matching", () => {
    it("should match wildcard patterns", () => {
      const shouldWatch = (service as any).shouldWatchConfiguration("any.key");
      expect(shouldWatch).toBe(true);
    });

    it("should match specific patterns", () => {
      // Mock specific patterns
      (service as any).options.watchPatterns = ["app.*", "db.*"];

      const shouldWatchApp = (service as any).shouldWatchConfiguration("app.config");
      const shouldWatchDb = (service as any).shouldWatchConfiguration("db.host");
      const shouldNotWatch = (service as any).shouldWatchConfiguration("other.config");

      expect(shouldWatchApp).toBe(true);
      expect(shouldWatchDb).toBe(true);
      expect(shouldNotWatch).toBe(false);
    });
  });

  describe("buildWatchKey", () => {
    it("should build correct watch key", () => {
      const watchKey = (service as any).buildWatchKey(
        "test.key",
        ConfigurationScope.TENANT,
        "tenant-1",
        "production",
      );

      expect(watchKey).toBe("test.key:tenant:tenant-1:production");
    });

    it("should build watch key without optional parameters", () => {
      const watchKey = (service as any).buildWatchKey("test.key", ConfigurationScope.GLOBAL);

      expect(watchKey).toBe("test.key:global");
    });
  });
});
