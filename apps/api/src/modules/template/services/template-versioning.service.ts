import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { TemplateVersion } from "../entities/template-version.entity";

export interface CreateTemplateVersionDto {
  templateId: string;
  name: string;
  description?: string;
  subject?: string;
  data: string;
  htmlContent?: string;
  variables?: Record<string, any>;
  channels?: string[];
  metadata?: Record<string, any>;
  changeLog?: string;
  createdBy?: string;
}

export interface UpdateTemplateVersionDto {
  name?: string;
  description?: string;
  subject?: string;
  data?: string;
  htmlContent?: string;
  variables?: Record<string, any>;
  channels?: string[];
  metadata?: Record<string, any>;
  changeLog?: string;
}

@Injectable()
export class TemplateVersioningService {
  private readonly logger = new Logger(TemplateVersioningService.name);

  constructor(
    @InjectRepository(TemplateVersion)
    private readonly versionRepository: Repository<TemplateVersion>,
  ) {}

  async createVersion(dto: CreateTemplateVersionDto): Promise<TemplateVersion> {
    const lastVersion = await this.versionRepository.findOne({
      where: { templateId: dto.templateId },
      order: { version: "DESC" },
    });

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const version = this.versionRepository.create({
      templateId: dto.templateId,
      version: nextVersion,
      name: dto.name,
      description: dto.description,
      subject: dto.subject,
      data: dto.data,
      htmlContent: dto.htmlContent,
      variables: dto.variables || {},
      channels: dto.channels || [],
      metadata: dto.metadata,
      changeLog: dto.changeLog,
      createdBy: dto.createdBy,
      isActive: false,
    });

    const saved = await this.versionRepository.save(version);
    this.logger.log(`Created template version ${nextVersion} for template ${dto.templateId}`);

    return saved;
  }

  async getVersion(versionId: string): Promise<TemplateVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException(`Template version ${versionId} not found`);
    }

    return version;
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.versionRepository.find({
      where: { templateId },
      order: { version: "DESC" },
    });
  }

  async getActiveVersion(templateId: string): Promise<TemplateVersion | null> {
    return this.versionRepository.findOne({
      where: { templateId, isActive: true },
    });
  }

  async activateVersion(versionId: string): Promise<TemplateVersion> {
    const version = await this.getVersion(versionId);

    await this.versionRepository.update(
      { templateId: version.templateId, isActive: true },
      { isActive: false },
    );

    version.isActive = true;
    const updated = await this.versionRepository.save(version);

    this.logger.log(
      `Activated template version ${version.version} for template ${version.templateId}`,
    );

    return updated;
  }

  async rollbackToVersion(versionId: string): Promise<TemplateVersion> {
    const version = await this.getVersion(versionId);

    if (version.isActive) {
      throw new BadRequestException("Version is already active");
    }

    return this.activateVersion(versionId);
  }

  async updateVersion(versionId: string, dto: UpdateTemplateVersionDto): Promise<TemplateVersion> {
    const version = await this.getVersion(versionId);

    if (version.isActive) {
      throw new BadRequestException("Cannot update active version. Create a new version instead.");
    }

    Object.assign(version, dto);
    const updated = await this.versionRepository.save(version);

    this.logger.log(`Updated template version ${versionId}`);

    return updated;
  }

  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.getVersion(versionId);

    if (version.isActive) {
      throw new BadRequestException("Cannot delete active version");
    }

    await this.versionRepository.delete(versionId);
    this.logger.log(`Deleted template version ${versionId}`);
  }

  async previewTemplate(
    versionId: string,
    variables: Record<string, any>,
  ): Promise<{ subject?: string; data: string; htmlContent?: string }> {
    const version = await this.getVersion(versionId);

    return {
      subject: this.renderTemplate(version.subject || "", variables),
      data: this.renderTemplate(version.data, variables),
      htmlContent: version.htmlContent
        ? this.renderTemplate(version.htmlContent, variables)
        : undefined,
    };
  }

  async validateTemplateVariables(
    versionId: string,
    variables: Record<string, any>,
  ): Promise<{ valid: boolean; missingVariables: string[] }> {
    const version = await this.getVersion(versionId);

    const requiredVariables = Object.keys(version.variables || {});
    const providedVariables = Object.keys(variables);

    const missingVariables = requiredVariables.filter((v) => !providedVariables.includes(v));

    return {
      valid: missingVariables.length === 0,
      missingVariables,
    };
  }

  async getVersionHistory(templateId: string): Promise<
    Array<{
      version: number;
      name: string;
      createdAt: Date;
      createdBy?: string;
      changeLog?: string;
      isActive: boolean;
    }>
  > {
    const versions = await this.getTemplateVersions(templateId);

    return versions.map((v) => ({
      version: v.version,
      name: v.name,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      changeLog: v.changeLog,
      isActive: v.isActive,
    }));
  }

  async compareVersions(
    versionId1: string,
    versionId2: string,
  ): Promise<{
    version1: TemplateVersion;
    version2: TemplateVersion;
    differences: Record<string, { old: any; new: any }>;
  }> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    const differences: Record<string, { old: any; new: any }> = {};

    const fields = ["name", "subject", "data", "htmlContent", "variables", "channels"];

    for (const field of fields) {
      const val1 = (version1 as any)[field];
      const val2 = (version2 as any)[field];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences[field] = { old: val1, new: val2 };
      }
    }

    return { version1, version2, differences };
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  async getVersionCount(templateId: string): Promise<number> {
    return this.versionRepository.count({
      where: { templateId },
    });
  }
}
