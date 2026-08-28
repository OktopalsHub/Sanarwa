import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProviderConfig } from "./provider-config.entity";
import { decryptProviderConfig, decryptProviderConfigs } from "./provider-config.helpers";
import { ProviderEncryptionService } from "./provider-encryption.service";

@Injectable()
export class ProviderConfigQueryService {
  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly encryptionService: ProviderEncryptionService,
  ) {}

  async getAvailableProviders(
    tenantId: string,
    channel: NotificationChannel,
  ): Promise<ProviderConfig[]> {
    return this.providerConfigRepository.find({
      where: {
        project: { tenant: { id: tenantId } },
        channel,
        isActive: true,
      },
      relations: ["project", "project.tenant"],
      order: {
        priority: "ASC",
        createdAt: "ASC",
      },
    });
  }

  async findAllConfigs(
    tenantId: string,
    query: any,
  ): Promise<{
    configs: ProviderConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .leftJoinAndSelect("project.tenant", "tenant");

    queryBuilder.where("project.tenantId = :tenantId", { tenantId });

    if (query.channel) {
      queryBuilder.andWhere("config.channel = :channel", {
        channel: query.channel,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere("config.isActive = :isActive", {
        isActive: query.isActive,
      });
    }

    if (query.providerType) {
      queryBuilder.andWhere("config.providerType = :providerType", {
        providerType: query.providerType,
      });
    }

    const total = await queryBuilder.getCount();

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();
    const decryptedConfigs = await decryptProviderConfigs(this.encryptionService, configs);

    return {
      configs: decryptedConfigs,
      total,
      page,
      limit,
    };
  }

  async findConfigsByProject(
    tenantId: string,
    projectId: string,
    query: any,
  ): Promise<{
    configs: ProviderConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .leftJoinAndSelect("project.tenant", "tenant");

    queryBuilder
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("config.projectId = :projectId", { projectId });

    if (query.channel) {
      queryBuilder.andWhere("config.channel = :channel", {
        channel: query.channel,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere("config.isActive = :isActive", {
        isActive: query.isActive,
      });
    }

    const total = await queryBuilder.getCount();

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();
    const decryptedConfigs = await decryptProviderConfigs(this.encryptionService, configs);

    return {
      configs: decryptedConfigs,
      total,
      page,
      limit,
    };
  }

  async findConfigById(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    return decryptProviderConfig(this.encryptionService, config);
  }
}
