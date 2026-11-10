import { ConfigService } from "@nestjs/config";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigurationScope } from "../../entities/configuration.entity";
import { ConfigurationCacheService } from "../configuration-cache.service";

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock("ioredis", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => mockRedisInstance),
}));

describe("ConfigurationCacheService", () => {
  let service: ConfigurationCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationCacheService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: getRedisConnectionToken(), useValue: mockRedisInstance },
      ],
    }).compile();

    service = module.get<ConfigurationCacheService>(ConfigurationCacheService);
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("get returns the parsed value on a cache hit and builds the key", async () => {
    mockRedisInstance.get.mockResolvedValue(JSON.stringify({ theme: "dark" }));

    const value = await service.get<{ theme: string }>(
      "ui.theme",
      ConfigurationScope.GLOBAL,
      undefined,
      "production",
    );

    expect(value).toEqual({ theme: "dark" });
    expect(mockRedisInstance.get).toHaveBeenCalledWith("config:global::production:ui.theme");
  });

  it("get returns undefined on a cache miss", async () => {
    mockRedisInstance.get.mockResolvedValue(null);

    const value = await service.get("missing.key", ConfigurationScope.GLOBAL);

    expect(value).toBeUndefined();
  });

  it("get propagates Redis errors rather than reading them as a miss", async () => {
    mockRedisInstance.get.mockRejectedValue(new Error("Redis error"));

    await expect(service.get("test.key", ConfigurationScope.GLOBAL)).rejects.toThrow("Redis error");
  });

  it("set stores the JSON payload with a PX ttl", async () => {
    mockRedisInstance.set.mockResolvedValue("OK");

    await service.set(
      "feature.flag",
      ConfigurationScope.TENANT,
      { enabled: true },
      "t-1",
      "production",
      30_000,
    );

    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "config:tenant:t-1:production:feature.flag",
      JSON.stringify({ enabled: true }),
      "PX",
      30_000,
    );
  });

  it("set uses the default TTL when none is given", async () => {
    mockRedisInstance.set.mockResolvedValue("OK");

    await service.set("feature.flag", ConfigurationScope.GLOBAL, false);

    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "config:global:::feature.flag",
      JSON.stringify(false),
      "PX",
      60_000,
    );
  });

  it("invalidate deletes the computed key", async () => {
    mockRedisInstance.del.mockResolvedValue(1);

    await service.invalidate("feature.flag", ConfigurationScope.TENANT, "t-1", "staging");

    expect(mockRedisInstance.del).toHaveBeenCalledWith("config:tenant:t-1:staging:feature.flag");
  });

  it("clear scans and deletes config keys", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce(["0", ["config:a", "config:b"]]);
    mockRedisInstance.del.mockResolvedValue(2);

    await service.clear();

    expect(mockRedisInstance.scan).toHaveBeenCalledWith("0", "MATCH", "config:*", "COUNT", 100);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(["config:a", "config:b"]);
  });

  it("clear does not call del when no keys match", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce(["0", []]);

    await service.clear();

    expect(mockRedisInstance.del).not.toHaveBeenCalled();
  });

  it("clear keeps scanning until the cursor returns to 0", async () => {
    mockRedisInstance.scan
      .mockResolvedValueOnce(["42", ["config:a"]])
      .mockResolvedValueOnce(["0", ["config:b"]]);
    mockRedisInstance.del.mockResolvedValue(2);

    await service.clear();

    expect(mockRedisInstance.del).toHaveBeenCalledWith(["config:a", "config:b"]);
  });

  it("getStats reports the number of cached entries", async () => {
    mockRedisInstance.scan.mockResolvedValueOnce(["0", ["config:a", "config:b", "config:c"]]);

    const stats = await service.getStats();

    expect(stats).toEqual({ totalKeys: 3, memoryUsage: "3 entries" });
  });
});
