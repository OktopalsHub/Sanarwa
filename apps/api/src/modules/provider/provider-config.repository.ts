import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseRepository } from "../../common/database/repositories/base.repository";
import { ProviderConfig } from "./provider-config.entity";

@Injectable()
export class ProviderConfigRepository extends BaseRepository<ProviderConfig> {
  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
  ) {
    super(providerConfigRepository);
  }

  async findByTenantId(tenantId: string): Promise<ProviderConfig[]> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId })
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .getMany();
  }

  async findByProjectId(projectId: string): Promise<ProviderConfig[]> {
    return this.providerConfigRepository.find({
      where: { projectId },
      relations: { project: true },
      order: {
        priority: "ASC",
        createdAt: "DESC",
      },
    });
  }

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

  async findByIdAndTenant(id: string, tenantId: string): Promise<ProviderConfig | null> {
    return this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .where("config.id = :id", { id })
      .andWhere("project.tenantId = :tenantId", { tenantId })
      .getOne();
  }

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
}
