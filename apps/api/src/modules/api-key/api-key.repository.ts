import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "../../common/database/repositories/base.repository";
import { ApiKey } from "./entities/api-key.entity";

@Injectable()
export class ApiKeyRepository extends BaseRepository<ApiKey> {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {
    super(apiKeyRepository);
  }

  async findByKeyPrefix(keyPrefix: string): Promise<ApiKey | null> {
    return this.apiKeyRepository.findOne({
      where: { keyPrefix },
      relations: {
        project: {
          tenant: true,
        },
        createdBy: true,
      },
    });
  }

  async findByTenantId(tenantId: string, projectId?: string): Promise<ApiKey[]> {
    const queryBuilder = this.apiKeyRepository
      .createQueryBuilder("apiKey")
      .leftJoinAndSelect("apiKey.project", "project")
      .where("project.tenantId = :tenantId", { tenantId });

    if (projectId) {
      queryBuilder.andWhere("apiKey.projectId = :projectId", { projectId });
    }

    return queryBuilder.orderBy("apiKey.createdAt", "DESC").getMany();
  }

  async findByIdAndTenant(id: string, tenantId: string, projectId: string): Promise<ApiKey | null> {
    return this.apiKeyRepository
      .createQueryBuilder("apiKey")
      .leftJoinAndSelect("apiKey.project", "project")
      .where("apiKey.id = :id", { id })
      .andWhere("project.id = :projectId", { projectId })
      .andWhere("project.tenantId = :tenantId", { tenantId })
      .getOne();
  }

  async updateUsage(apiKeyId: string, ipAddress?: string): Promise<void> {
    await this.apiKeyRepository.update(apiKeyId, {
      lastUsedAt: new Date(),
      lastUsedIp: ipAddress,
      usageCount: () => "usage_count + 1",
    });
  }

  async existsByNameAndProject(
    name: string,
    projectId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const queryBuilder = this.apiKeyRepository
      .createQueryBuilder("apiKey")
      .where("apiKey.projectId = :projectId", { projectId })
      .andWhere("apiKey.name = :name", { name });

    if (excludeId) {
      queryBuilder.andWhere("apiKey.id != :excludeId", { excludeId });
    }

    const count = await queryBuilder.getCount();
    return count > 0;
  }
}
