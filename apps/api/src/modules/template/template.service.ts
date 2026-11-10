import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import * as Handlebars from "handlebars";

import { Template } from "./template.entity";
import { TemplateVersion } from "./entities/template-version.entity";
import { TemplateValidatorService } from "./services/template-validator.service";
import { uniqueTemplateSlug } from "./services/template-slug";
import { TemplateRendererService } from "./services/template-renderer.service";
import { TemplateVersioningService } from "./services/template-versioning.service";
import { TemplateProjectService } from "./services/template-project.service";
import { TemplateCacheService } from "./services/template-cache.service";
import { TemplateStatus } from "../../common/enums/template.enum";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { TemplateQueryDto } from "./dto/template-query.dto";
import { RenderTemplateDto } from "./dto/render-template.dto";

export interface TemplateListResult {
  data: Template[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly repo: Repository<Template>,
    private readonly validatorService: TemplateValidatorService,
    private readonly rendererService: TemplateRendererService,
    private readonly versioningService: TemplateVersioningService,
    private readonly projectService: TemplateProjectService,
    private readonly cacheService: TemplateCacheService,
  ) {}

  async createTemplate(
    dto: CreateTemplateDto & { tenantId: string },
    memberId?: string,
  ): Promise<Template> {
    const slug = await uniqueTemplateSlug(this.repo, dto.tenantId, undefined, dto.name);

    const template = this.repo.create({
      tenantId: dto.tenantId,
      name: slug,
      description: dto.description,
      isDefault: dto.isDefault ?? false,
      channel: dto.channel,
      subject: dto.subject,
      data: dto.data,
      variables: dto.variables,
      channelSpecific: dto.channelSpecific,
      status: TemplateStatus.DRAFT,
      version: 1,
    });

    if (memberId) {
      template.createdBy = { id: memberId } as Template["createdBy"];
    }

    const saved = await this.repo.save(template);
    this.cacheService.invalidateTenantTemplates(dto.tenantId);
    return saved;
  }

  async getAllTemplates(query: TemplateQueryDto): Promise<TemplateListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const channel = query.channel ? query.channel : null;

    const where: FindOptionsWhere<Template> = { tenantId: query.tenantId };
    if (channel) where.channel = channel;
    if (query.status) where.status = query.status;
    if (query.name) where.name = query.name;
    if (query.parentTemplateId) where.parentTemplateId = query.parentTemplateId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getTemplateById(id: string, tenantId: string): Promise<Template> {
    const template = await this.repo.findOne({ where: { id, tenantId } });
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  async updateTemplate(
    id: string,
    dto: UpdateTemplateDto & { tenantId: string },
  ): Promise<Template> {
    const template = await this.getTemplateById(id, dto.tenantId);

    const { tenantId: _tenantId, ...changes } = dto;

    if (changes.name !== undefined) {
      changes.name = await uniqueTemplateSlug(
        this.repo,
        template.tenantId,
        template.projectId,
        changes.name,
        template.id,
      );
    }

    Object.assign(template, changes);

    const saved = await this.repo.save(template);
    this.cacheService.invalidateTenantTemplates(dto.tenantId);
    return saved;
  }

  async deleteTemplate(id: string, tenantId: string): Promise<void> {
    const result = await this.repo.delete({ id, tenantId });
    if (!result.affected) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    this.cacheService.invalidateTenantTemplates(tenantId);
  }

  async createVersion(
    templateId: string,
    dto: UpdateTemplateDto & { tenantId: string },
  ): Promise<TemplateVersion> {
    await this.getTemplateById(templateId, dto.tenantId);

    return this.versioningService.createVersion({
      templateId,
      name: dto.name ?? `v${Date.now()}`,
      description: dto.description,
      subject: dto.subject,
      data: dto.data ?? "",
    });
  }

  async getVersions(templateId: string, tenantId: string): Promise<TemplateVersion[]> {
    await this.getTemplateById(templateId, tenantId);
    return this.versioningService.getTemplateVersions(templateId);
  }

  async activateVersion(templateId: string, tenantId: string): Promise<TemplateVersion> {
    await this.getTemplateById(templateId, tenantId);
    const active = await this.versioningService.getActiveVersion(templateId);

    if (!active) {
      throw new BadRequestException(`Template ${templateId} has no active version to promote`);
    }

    const promoted = await this.versioningService.activateVersion(active.id);
    await this.repo.update({ id: templateId, tenantId }, { version: promoted.version });
    return promoted;
  }

  async archive(id: string, tenantId: string): Promise<Template> {
    const template = await this.getTemplateById(id, tenantId);
    template.status = TemplateStatus.ARCHIVED;
    const saved = await this.repo.save(template);
    this.cacheService.invalidateTenantTemplates(tenantId);
    return saved;
  }

  async duplicate(id: string, newName: string, tenantId: string): Promise<Template> {
    const source = await this.getTemplateById(id, tenantId);

    if (!source.projectId) {
      throw new BadRequestException(
        `Template ${id} is not attached to a project; duplication needs a target project`,
      );
    }

    return this.projectService.duplicateTemplate({
      sourceTemplateId: id,
      targetProjectId: source.projectId,
      newName,
      tenantId,
    });
  }

  async render(dto: RenderTemplateDto) {
    const template = await this.getTemplateById(dto.templateId, dto.tenantId);

    if (dto.version) {
      const version = await this.versioningService.getVersion(dto.version);
      return {
        data: this.compile(version.data, dto.variables),
        subject: version.subject ? this.compile(version.subject, dto.variables) : undefined,
        htmlContent: version.htmlContent
          ? this.compile(version.htmlContent, dto.variables)
          : undefined,
      };
    }

    return {
      data: this.compile(template.data ?? "", dto.variables),
      subject: template.subject ? this.compile(template.subject, dto.variables) : undefined,
      htmlContent:
        typeof template.meta?.html === "string"
          ? this.compile(template.meta.html, dto.variables)
          : undefined,
    };
  }

  async validate(id: string, tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const template = await this.getTemplateById(id, tenantId);
    return { valid: true, errors: this.structuralChecks(template) };
  }

  async validateData(
    id: string,
    data: Record<string, any>,
    tenantId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const template = await this.getTemplateById(id, tenantId);
    const declared = template.variables ?? [];
    const provided = Object.keys(data ?? {});
    const errors = declared
      .filter((variable) => !provided.includes(variable.name))
      .map((variable) => `Missing required variable: ${variable.name}`);

    return { valid: errors.length === 0, errors };
  }

  async findByChannel(tenantId: string, channel: NotificationChannel): Promise<Template[]> {
    return this.repo.find({
      where: { tenantId, channel, status: TemplateStatus.ACTIVE },
      order: { createdAt: "DESC" },
    });
  }

  async findDefaultTemplate(tenantId: string, channel: NotificationChannel): Promise<Template> {
    const template = await this.repo.findOne({
      where: { tenantId, channel, status: TemplateStatus.ACTIVE },
      order: { createdAt: "DESC" },
    });

    if (!template) {
      throw new NotFoundException(`No active template for channel ${channel}`);
    }

    return template;
  }

  private structuralChecks(template: Template): string[] {
    const errors: string[] = [];

    if (!template.name) errors.push("Template name is required");
    if (!template.channel) errors.push("Template channel is required");
    if (!template.data && !template.subject && !template.meta?.html) {
      errors.push("Template needs subject, data or html");
    }

    return errors;
  }

  private compile(source: string, data: Record<string, any>): string {
    try {
      return Handlebars.compile(source)(data ?? {});
    } catch (error) {
      return source;
    }
  }
}
