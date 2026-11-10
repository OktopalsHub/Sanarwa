import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseRepository } from "../../common/database/repositories/base.repository";
import { Project } from "./entities/project.entity";

@Injectable()
export class ProjectRepository extends BaseRepository<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {
    super(projectRepository);
  }

  async getAllProjectsByTenantId(tenantId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true, brand: true },
      order: { createdAt: "DESC" },
    });
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: { tenant: true, brand: true },
    });
  }

  async getProjectWithApiKeys(id: string, tenantId: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: { tenant: true, brand: true, apiKeys: true },
    });
  }

  async getProjectWithProviderConfigs(id: string, tenantId: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: { tenant: true, brand: true, providerConfigs: true },
    });
  }

  async existsByNameAndTenant(
    name: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const queryBuilder = this.projectRepository
      .createQueryBuilder("project")
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("project.name = :name", { name });

    if (excludeId) {
      queryBuilder.andWhere("project.id != :excludeId", { excludeId });
    }

    const count = await queryBuilder.getCount();
    return count > 0;
  }
}
