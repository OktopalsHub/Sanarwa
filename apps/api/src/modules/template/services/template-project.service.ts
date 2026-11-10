import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { BaseRepository } from "../../../common/database/repositories/base.repository";
import { ProjectRepository } from "../../project/project.repository";
import { Template } from "../template.entity";
import { TEMPLATE_REPO } from "../template.tokens";
import { uniqueTemplateSlug } from "./template-slug";

export interface DuplicateTemplateDto {
  sourceTemplateId: string;
  targetProjectId: string;
  newName?: string;
  tenantId: string;
  userId?: string;
}

export interface CopyTemplateDto {
  sourceTemplateId: string;
  targetProjectId: string;
  newName: string;
  tenantId: string;
  userId?: string;
  modifications?: {
    description?: string;
    data?: string;
    subject?: string;
    variables?: any[];
  };
}

@Injectable()
export class TemplateProjectService {
  private readonly logger = new Logger(TemplateProjectService.name);

  constructor(
    @Inject(TEMPLATE_REPO)
    private readonly templateRepository: BaseRepository<Template>,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async getProjectTemplates(projectId: string, tenantId: string): Promise<Template[]> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return await this.templateRepository.find({
      where: { projectId, tenantId },
      order: { createdAt: "DESC" },
    });
  }

  async duplicateTemplate(dto: DuplicateTemplateDto): Promise<Template> {
    const sourceTemplate = await this.templateRepository.findOne({
      where: { id: dto.sourceTemplateId, tenantId: dto.tenantId },
    });

    if (!sourceTemplate) {
      throw new NotFoundException(`Template ${dto.sourceTemplateId} not found`);
    }

    const targetProject = await this.projectRepository.findOne({
      where: { id: dto.targetProjectId, tenantId: dto.tenantId },
    });

    if (!targetProject) {
      throw new NotFoundException(`Target project ${dto.targetProjectId} not found`);
    }

    const { id, createdAt, updatedAt, createdBy, ...templateData } = sourceTemplate;

    const newName = await uniqueTemplateSlug(
      this.templateRepository,
      dto.tenantId,
      dto.targetProjectId,
      dto.newName || (sourceTemplate.name ? `${sourceTemplate.name} (Copy)` : "template (Copy)"),
    );

    const duplicateData = {
      ...templateData,
      name: newName,
      projectId: dto.targetProjectId,
      version: 1,
      parentTemplateId: dto.sourceTemplateId,
      ...(dto.userId && { createdBy: { id: dto.userId } }),
    };

    const savedTemplate = await this.templateRepository.create(duplicateData);

    this.logger.log(
      `Template ${dto.sourceTemplateId} duplicated to project ${dto.targetProjectId} as ${savedTemplate.id}`,
    );

    return savedTemplate;
  }

  async copyTemplateWithModifications(dto: CopyTemplateDto): Promise<Template> {
    const duplicated = await this.duplicateTemplate({
      sourceTemplateId: dto.sourceTemplateId,
      targetProjectId: dto.targetProjectId,
      newName: dto.newName,
      tenantId: dto.tenantId,
      userId: dto.userId,
    });

    if (dto.modifications) {
      await this.templateRepository.update(duplicated.id, dto.modifications);
    }

    this.logger.log(`Template copied with modifications: ${duplicated.id}`);

    return duplicated;
  }

  async moveTemplateToProject(
    templateId: string,
    targetProjectId: string,
    tenantId: string,
  ): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const targetProject = await this.projectRepository.findOne({
      where: { id: targetProjectId, tenantId },
    });

    if (!targetProject) {
      throw new NotFoundException(`Target project ${targetProjectId} not found`);
    }

    const slug = await uniqueTemplateSlug(
      this.templateRepository,
      tenantId,
      targetProjectId,
      template.name ?? "template",
      template.id,
    );

    await this.templateRepository.update(template.id, {
      projectId: targetProjectId,
      name: slug,
    });

    this.logger.log(`Template ${templateId} moved to project ${targetProjectId}`);

    return template;
  }

  async bulkDuplicateTemplates(
    templateIds: string[],
    targetProjectId: string,
    tenantId: string,
    userId?: string,
  ): Promise<{
    successful: Array<{ sourceId: string; newId: string }>;
    failed: Array<{ sourceId: string; error: string }>;
  }> {
    const successful: Array<{ sourceId: string; newId: string }> = [];
    const failed: Array<{ sourceId: string; error: string }> = [];

    for (const templateId of templateIds) {
      try {
        const duplicated = await this.duplicateTemplate({
          sourceTemplateId: templateId,
          targetProjectId,
          tenantId,
          userId,
        });

        successful.push({ sourceId: templateId, newId: duplicated.id });
      } catch (error) {
        failed.push({ sourceId: templateId, error: error.message });
      }
    }

    return { successful, failed };
  }

  async getTemplateUsageStats(
    templateId: string,
    tenantId: string,
  ): Promise<{
    templateId: string;
    name: string;
    projectId: string;
    projectName: string;
    duplicates: number;
    versions: number;
  }> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, tenantId },
      relations: { project: true },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const duplicates = await this.templateRepository.count({
      parentTemplateId: templateId,
      tenantId,
    });

    const versions = await this.templateRepository.count({
      parentTemplateId: template.parentTemplateId || templateId,
      tenantId,
    });

    return {
      templateId: template.id,
      name: template.name ?? "Unnamed",
      projectId: template.projectId || "",
      projectName: (template as any).project?.name || "No Project",
      duplicates,
      versions: versions + 1,
    };
  }

  async compareTemplates(
    templateId1: string,
    templateId2: string,
    tenantId: string,
  ): Promise<{
    template1: Partial<Template>;
    template2: Partial<Template>;
    differences: string[];
  }> {
    const template1 = await this.templateRepository.findOne({
      where: { id: templateId1, tenantId },
    });

    const template2 = await this.templateRepository.findOne({
      where: { id: templateId2, tenantId },
    });

    if (!template1 || !template2) {
      throw new NotFoundException("One or both templates not found");
    }

    const differences: string[] = [];

    if (template1.name !== template2.name) {
      differences.push(`Name: "${template1.name}" vs "${template2.name}"`);
    }
    if (template1.channel !== template2.channel) {
      differences.push(`NotificationChannel: ${template1.channel} vs ${template2.channel}`);
    }
    if (template1.subject !== template2.subject) {
      differences.push(`Subject: "${template1.subject}" vs "${template2.subject}"`);
    }
    if (template1.data !== template2.data) {
      differences.push("Data differs");
    }
    if (JSON.stringify(template1.variables) !== JSON.stringify(template2.variables)) {
      differences.push("Variables differ");
    }

    return {
      template1: {
        id: template1.id,
        name: template1.name,
        channel: template1.channel,
        version: template1.version,
      },
      template2: {
        id: template2.id,
        name: template2.name,
        channel: template2.channel,
        version: template2.version,
      },
      differences,
    };
  }
}
