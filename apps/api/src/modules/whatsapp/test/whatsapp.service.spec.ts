import { Test, TestingModule } from "@nestjs/testing";
import { WhatsAppBusinessAPIService } from "../services/whatsapp-business-api.service";
import { WhatsAppEmbeddedSignupService } from "../services/whatsapp-embedded-signup.service";
import { WhatsAppMultiTenantTemplateService } from "../services/whatsapp-multi-tenant-template.service";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";
import { WABAConfig } from "../entities/waba-config.entity";
import { TenantWABAConfig } from "../entities/tenant-waba-config.entity";
import type { Mock, Mocked } from "vitest";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import Redis from "ioredis-mock";
import { ChannelsService } from "../../channels/channels.service";

describe("WhatsAppBusinessAPIService", () => {
  let service: WhatsAppBusinessAPIService;
  let wabaConfigRepository: Mocked<Repository<WABAConfig>>;
  let tenantWabaConfigRepository: Mocked<Repository<TenantWABAConfig>>;
  let httpService: Mocked<HttpService>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppBusinessAPIService,
        {
          provide: getRepositoryToken(WABAConfig),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TenantWABAConfig),
          useValue: mockRepository,
        },
        {
          provide: HttpService,
          useValue: {
            post: vi.fn(),
            get: vi.fn(),
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

    service = module.get<WhatsAppBusinessAPIService>(WhatsAppBusinessAPIService);
    wabaConfigRepository = module.get(getRepositoryToken(WABAConfig));
    tenantWabaConfigRepository = module.get(getRepositoryToken(TenantWABAConfig));
    httpService = module.get(HttpService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sendTextMessage", () => {
    it("should send a WhatsApp text message and return its id", async () => {
      httpService.post.mockReturnValue(of({ data: { messages: [{ id: "msg-123" }] } }));

      const result = await service.sendTextMessage("+1 (234) 567-8900", "Hello World");

      expect(result.messageId).toBe("msg-123");
      const [url, body] = httpService.post.mock.calls[0];
      expect(url).toContain("/messages");
      expect(body).toMatchObject({
        messaging_product: "whatsapp",
        to: "+12345678900",
        type: "text",
        text: { body: "Hello World" },
      });
    });

    it("should surface a readable error when the upstream call fails", async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({ error: { message: "Invalid phone number" } })),
      );

      await expect(service.sendTextMessage("+1234567890", "Hi")).rejects.toThrow(
        /Failed to send WhatsApp text message/,
      );
    });
  });

  describe("validatePhoneNumber", () => {
    it("should accept an international number", () => {
      expect(service.validatePhoneNumber("+12345678900").isValid).toBe(true);
    });

    it("should reject a malformed number", () => {
      expect(service.validatePhoneNumber("not-a-number").isValid).toBe(false);
    });
  });

  describe("getTemplateStatus", () => {
    it("should return the template status", async () => {
      httpService.get.mockReturnValue(of({ data: { status: "APPROVED" } }));

      const result = await service.getTemplateStatus("tpl-1");

      expect(result.status).toBe("APPROVED");
    });
  });

  describe("sendTemplateMessage", () => {
    it("should send a template message and return its id", async () => {
      httpService.post.mockReturnValue(of({ data: { messages: [{ id: "msg-template-123" }] } }));

      const result = await service.sendTemplateMessage("+12345678900", "welcome_message", "en");

      expect(result.messageId).toBe("msg-template-123");
      const [, body] = httpService.post.mock.calls[0];
      expect(body).toMatchObject({
        type: "template",
        template: { name: "welcome_message", language: { code: "en" } },
      });
    });
  });

  describe("listTemplates", () => {
    it("should return the template list from the API", async () => {
      httpService.get.mockReturnValue(of({ data: { data: [{ id: "tpl-1", name: "welcome" }] } }));

      const result = await service.listTemplates();

      expect(result).toHaveLength(1);
    });
  });
});

describe("WhatsAppEmbeddedSignupService", () => {
  let service: WhatsAppEmbeddedSignupService;
  let wabaConfigRepository: Mocked<Repository<WABAConfig>>;
  let tenantWabaConfigRepository: Mocked<Repository<TenantWABAConfig>>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppEmbeddedSignupService,
        {
          provide: getRepositoryToken(WABAConfig),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TenantWABAConfig),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
        {
          provide: ChannelsService,
          useValue: {
            upsert: vi.fn(),
            findConfig: vi.fn().mockResolvedValue(null),
            remove: vi.fn(),
          },
        },
        {
          provide: getRedisConnectionToken(),
          useValue: new Redis(),
        },
      ],
    }).compile();

    service = module.get<WhatsAppEmbeddedSignupService>(WhatsAppEmbeddedSignupService);
    wabaConfigRepository = module.get(getRepositoryToken(WABAConfig));
    tenantWabaConfigRepository = module.get(getRepositoryToken(TenantWABAConfig));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getTenantWABA", () => {
    it("should return the tenant's active WABA config", async () => {
      const mockConfig = { id: "1", wabaId: "waba-123", isActive: true };
      tenantWabaConfigRepository.findOne.mockResolvedValue(mockConfig as TenantWABAConfig);

      const result = await service.getTenantWABA("tenant-1");

      expect(result).toEqual(mockConfig);
      expect(tenantWabaConfigRepository.findOne).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", isActive: true },
        relations: { waba: true },
      });
    });

    it("should return null when the tenant has no WABA", async () => {
      tenantWabaConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.getTenantWABA("tenant-1")).resolves.toBeNull();
    });
  });

  describe("canCreateTemplate", () => {
    it("should be false when the tenant has no WABA", async () => {
      tenantWabaConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.canCreateTemplate("tenant-1")).resolves.toBe(false);
    });
  });
});

describe("WhatsAppMultiTenantTemplateService", () => {
  let service: WhatsAppMultiTenantTemplateService;
  let embeddedSignupService: {
    getTenantWABA: ReturnType<typeof vi.fn>;
    canCreateTemplate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const mockRepository = { find: vi.fn(), findOne: vi.fn(), save: vi.fn(), create: vi.fn() };
    embeddedSignupService = {
      getTenantWABA: vi.fn(),
      canCreateTemplate: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppMultiTenantTemplateService,
        { provide: getRepositoryToken(WABAConfig), useValue: mockRepository },
        { provide: getRepositoryToken(TenantWABAConfig), useValue: mockRepository },
        { provide: WhatsAppEmbeddedSignupService, useValue: embeddedSignupService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue) },
        },
      ],
    }).compile();

    service = module.get<WhatsAppMultiTenantTemplateService>(WhatsAppMultiTenantTemplateService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createTemplate", () => {
    it("should refuse to create a template when the tenant has no WABA", async () => {
      embeddedSignupService.getTenantWABA.mockResolvedValue(null);

      await expect(
        service.createTemplate({
          name: "welcome_message",
          category: "MARKETING",
          language: "en",
          components: [],
          tenantId: "tenant-1",
        }),
      ).rejects.toThrow(/does not have a WhatsApp Business Account/);
    });

    it("should refuse to create a template when the tenant limit is reached", async () => {
      embeddedSignupService.getTenantWABA.mockResolvedValue({ id: "1" });
      embeddedSignupService.canCreateTemplate.mockResolvedValue(false);

      await expect(
        service.createTemplate({
          name: "welcome_message",
          category: "MARKETING",
          language: "en",
          components: [],
          tenantId: "tenant-1",
        }),
      ).rejects.toThrow(/Template limit reached/);
    });
  });

  describe("deleteTemplate", () => {
    it("should report success when the underlying delete succeeds", async () => {
      vi.spyOn(service as any, "deleteTenantTemplate").mockResolvedValue({ success: true });

      await expect(service.deleteTemplate("tenant-1", "template-123")).resolves.toEqual({
        success: true,
      });
    });
  });
});
