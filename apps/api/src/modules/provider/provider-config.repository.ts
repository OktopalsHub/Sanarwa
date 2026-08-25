import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseRepository } from "../../database/repositories/base.repository";
import { ProviderConfig } from "./provider-config.entity";

@Injectable()
export class ProviderConfigRepository extends BaseRepository<ProviderConfig> {
  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
  ) {
    super(providerConfigRepository);
  }

  /**
   * Find provider configs by tenant ID (through project)
   */
  async findByTenantId(tenantId: string): Promise<ProviderConfig[]> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId })
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .getMany();
  }

  /**
   * Find provider configs by project ID
   */
  async findByProjectId(projectId: string): Promise<ProviderConfig[]> {
    return this.providerConfigRepository.find({
      where: { projectId },
      relations: ["project"],
      order: {
        priority: "ASC",
        createdAt: "DESC",
      },
    });
  }

  /**
   * Find active provider configs for tenant and channel
   */
  async findActiveByTenantAndChannel(
    tenantId: string,
    channel: NotificationChannel,
  ): Promise<ProviderConfig[]> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("config.channel = :channel", { channel })
      .andWhere("config.isActive = :isActive", { isActive: true })
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "ASC")
      .getMany();
  }

  /**
   * Find provider config by ID and tenant ID (through project)
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<ProviderConfig | null> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("config.id = :id", { id })
      .andWhere("project.tenantId = :tenantId", { tenantId })
      .getOne();
  }

  /**
   * Find provider config by provider ID, channel, and tenant
   */
  async findByProviderAndTenant(
    providerId: string,
    channel: NotificationChannel,
    tenantId: string,
  ): Promise<ProviderConfig | null> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("config.providerId = :providerId", { providerId })
      .andWhere("config.channel = :channel", { channel })
      .andWhere("project.tenantId = :tenantId", { tenantId })
      .getOne();
  }

  /**
   * Update health status for a provider config
   */
  async updateHealthStatus(id: string, healthStatus: string, lastHealthCheck: Date): Promise<void> {
    await this.providerConfigRepository.update(id, {
      healthStatus,
      lastHealthCheck,
    });
  }
}
