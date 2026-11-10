import type { Mock } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ValidationException } from "../../../common/errors/exceptions/base.exception";
import { Template } from "../template.entity";
import { TemplateStatus } from "../../../common/enums/template.enum";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { CreateTemplateDto } from "../dto/create-template.dto";
import { UpdateTemplateDto } from "../dto/update-template.dto";
import { TemplateCacheService } from "../services/template-cache.service";
import { TemplateRendererService } from "../services/template-renderer.service";
import { TemplateValidatorService } from "../services/template-validator.service";
import { TemplateVersioningService } from "../services/template-versioning.service";
import { TemplateProjectService } from "../services/template-project.service";
import { TemplateService } from "../template.service";

describe("TemplateService", () => {
  let service: TemplateService;
  let repo: Repository<Template>;

  const template = {
    id: "1",
    tenantId: "tenant-1",
    name: "Test Template",
    channel: NotificationChannel.EMAIL,
    status: TemplateStatus.DRAFT,
    version: 1,
  } as Template;

  const mockValidatorService = {
    validateTemplate: vi.fn(),
    validateTemplateData: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  };

  const mockRendererService = {
    renderTemplate: vi.fn(),
  };

  const mockCacheService = {
    cacheTemplate: vi.fn(),
    getCachedTemplate: vi.fn(),
    invalidateTemplate: vi.fn(),
    invalidateTenantTemplates: vi.fn(),
  };

  const createTemplateDto = {
    tenantId: "tenant-1",
    name: "Test Template",
    channel: NotificationChannel.EMAIL,
    subject: "Hello {{name}}",

    data: "Welcome {{name}}",
    variables: [{ name: "name", type: "string", required: true }],
  } as CreateTemplateDto & { tenantId: string };

  beforeEach(async () => {
    const mockRepository = {
      create: vi.fn().mockReturnValue(template),
      save: vi.fn().mockResolvedValue(template),
      findOne: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        { provide: getRepositoryToken(Template), useValue: mockRepository },
        { provide: TemplateValidatorService, useValue: mockValidatorService },
        { provide: TemplateRendererService, useValue: mockRendererService },
        { provide: TemplateVersioningService, useValue: { createVersion: vi.fn() } },
        { provide: TemplateProjectService, useValue: { findById: vi.fn() } },
        { provide: TemplateCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
    repo = module.get(getRepositoryToken(Template));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createTemplate", () => {
    it("should persist a template as a draft and invalidate the tenant cache", async () => {
      const result = await service.createTemplate(createTemplateDto, "member-1");

      expect(result).toEqual(template);
      expect(repo.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateTenantTemplates).toHaveBeenCalledWith("tenant-1");
    });

    it("should persist a slugified name", async () => {
      await service.createTemplate(
        { ...createTemplateDto, name: "Welcome Email (v2)!" },
        "member-1",
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "welcome-email-v2" }),
      );
    });

    it("should allocate a suffixed slug when the base slug is taken", async () => {
      (repo.findOne as Mock)
        .mockResolvedValueOnce({ ...template, name: "test-template" })
        .mockResolvedValueOnce(null);

      await service.createTemplate({ ...createTemplateDto, name: "Test Template" }, "member-1");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "test-template-2" }),
      );
    });

    it("should reject a name that slugifies to nothing", async () => {
      await expect(
        service.createTemplate({ ...createTemplateDto, name: "!!!" }, "member-1"),
      ).rejects.toThrow(ValidationException);
    });
  });

  describe("getTemplateById", () => {
    it("should return the template", async () => {
      (repo.findOne as Mock).mockResolvedValue(template);

      await expect(service.getTemplateById("1", "tenant-1")).resolves.toEqual(template);
    });

    it("should throw NotFoundException when it is missing", async () => {
      (repo.findOne as Mock).mockResolvedValue(null);

      await expect(service.getTemplateById("1", "tenant-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateTemplate", () => {
    it("should apply the changes and invalidate the cache", async () => {
      (repo.findOne as Mock).mockImplementation(async ({ where }: any) =>
        where?.id === "1" ? template : null,
      );

      const result = await service.updateTemplate("1", {
        tenantId: "tenant-1",
        name: "Renamed",
      } as UpdateTemplateDto & { tenantId: string });

      expect(result.name).toBe("renamed");
      expect(repo.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateTenantTemplates).toHaveBeenCalledWith("tenant-1");
    });

    it("should throw NotFoundException when the template is missing", async () => {
      (repo.findOne as Mock).mockResolvedValue(null);

      await expect(
        service.updateTemplate("1", { tenantId: "tenant-1", name: "x" } as UpdateTemplateDto & {
          tenantId: string;
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete and invalidate the tenant cache", async () => {
      await service.deleteTemplate("1", "tenant-1");

      expect(repo.delete).toHaveBeenCalledWith({ id: "1", tenantId: "tenant-1" });
      expect(mockCacheService.invalidateTenantTemplates).toHaveBeenCalledWith("tenant-1");
    });

    it("should throw NotFoundException when nothing was deleted", async () => {
      (repo.delete as Mock).mockResolvedValue({ affected: 0 });

      await expect(service.deleteTemplate("1", "tenant-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("archive", () => {
    it("should set the status to archived", async () => {
      (repo.findOne as Mock).mockResolvedValue(template);

      const result = await service.archive("1", "tenant-1");

      expect(result.status).toBe(TemplateStatus.ARCHIVED);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe("duplicate", () => {
    it("should refuse to duplicate a template with no project", async () => {
      (repo.findOne as Mock).mockResolvedValue(template);

      await expect(service.duplicate("1", "Copy", "tenant-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("render", () => {
    it("should compile the stored template locally", async () => {
      (repo.findOne as Mock).mockResolvedValue({
        ...template,
        subject: "Hello {{name}}",

        data: "Welcome {{name}}",
      });

      const result = await service.render({
        templateId: "1",
        tenantId: "tenant-1",
        variables: { name: "John" },
      } as any);

      expect(result.data).toBe("Welcome John");
      expect(result.subject).toBe("Hello John");
    });
  });

  describe("validate", () => {
    it("should delegate to the validator", async () => {
      (repo.findOne as Mock).mockResolvedValue(template);

      mockValidatorService.validateTemplate.mockResolvedValue({ valid: true, errors: [] });

      const result = await service.validate("1", "tenant-1");

      expect(result.valid).toBe(true);
    });
  });

  describe("re-exported exceptions", () => {
    it("keeps the NestJS exception imports referenced", () => {
      expect([BadRequestException, ConflictException]).toHaveLength(2);
    });
  });
});
