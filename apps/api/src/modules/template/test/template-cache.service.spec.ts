import { Test, TestingModule } from "@nestjs/testing";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import { TemplateFactory } from "../../../test/factories/template.factory";
import { TemplateCacheService } from "../services/template-cache.service";

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  memory: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  })),
};

vi.mock("ioredis", () => ({
  default: class {
    setex = mockRedis.setex;
    get = mockRedis.get;
    del = mockRedis.del;
    exists = mockRedis.exists;
    expire = mockRedis.expire;
    keys = mockRedis.keys;
    memory = mockRedis.memory;
    pipeline = mockRedis.pipeline;
  },
}));

describe("TemplateCacheService", () => {
  let service: TemplateCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateCacheService,
        { provide: getRedisConnectionToken("default"), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TemplateCacheService>(TemplateCacheService);
  });

  beforeEach(() => {
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.setex.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("cacheTemplate", () => {
    it("should store the template under its prefixed key", async () => {
      const template = TemplateFactory.create();

      await service.cacheTemplate(template);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `template:${template.id}`,
        expect.any(Number),
        JSON.stringify(template),
      );
    });
  });

  describe("getCachedTemplate", () => {
    it("should return a cache hit", async () => {
      const template = TemplateFactory.create();
      mockRedis.get.mockResolvedValue(JSON.stringify(template));

      const result = await service.getCachedTemplate(template.id);

      expect(result?.id).toBe(template.id);
    });

    it("should return null on a miss", async () => {
      await expect(service.getCachedTemplate("missing")).resolves.toBeNull();
    });
  });

  describe("invalidateTemplate", () => {
    it("should delete the template key", async () => {
      await service.invalidateTemplate("template-1");

      expect(mockRedis.del).toHaveBeenCalledWith("template:template-1");
    });

    it("should also delete matching rendered entries", async () => {
      mockRedis.keys.mockResolvedValue(["rendered:template-1:a", "rendered:template-1:b"]);

      await service.invalidateTemplate("template-1");

      expect(mockRedis.del).toHaveBeenCalledWith("rendered:template-1:a", "rendered:template-1:b");
    });
  });

  describe("isTemplateCached", () => {
    it("should report whether the key exists", async () => {
      mockRedis.exists.mockResolvedValue(1);

      await expect(service.isTemplateCached("template-1")).resolves.toBe(true);
    });
  });

  describe("getCacheStats", () => {
    it("should count template and rendered keys", async () => {
      mockRedis.keys.mockResolvedValueOnce(["template:1", "template:2"]);
      mockRedis.keys.mockResolvedValueOnce(["rendered:1:a"]);
      mockRedis.memory.mockResolvedValue(["used_memory", 2048]);

      const stats = await service.getCacheStats();

      expect(stats.templateCount).toBe(2);
      expect(stats.renderedCount).toBe(1);
      expect(stats.totalMemory).toBe("2 KB");
    });
  });

  describe("clearAllCaches", () => {
    it("should delete every template and rendered key", async () => {
      mockRedis.keys.mockResolvedValueOnce(["template:1"]);
      mockRedis.keys.mockResolvedValueOnce(["rendered:1:a"]);

      await service.clearAllCaches();

      expect(mockRedis.del).toHaveBeenCalledWith("template:1", "rendered:1:a");
    });
  });

  describe("generateDataHash", () => {
    it("should return a stable hash for identical data", () => {
      expect(service.generateDataHash({ a: 1 })).toBe(service.generateDataHash({ a: 1 }));
    });

    it("should differ when the data differs", () => {
      expect(service.generateDataHash({ a: 1 })).not.toBe(service.generateDataHash({ a: 2 }));
    });
  });
});
