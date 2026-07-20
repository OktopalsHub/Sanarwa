import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/repositories/base.repository';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectRepository extends BaseRepository<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {
    super(projectRepository);
  }

  /**
   * Find all projects for a tenant
   */
  async getAllProjectsByTenantId(tenantId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { tenant: { id: tenantId } },
      relations: ['tenant', 'brand'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find project by ID and tenant ID
   */
  async findByIdAndTenant(
    id: string,
    tenantId: string,
  ): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['tenant', 'brand'],
    });
  }

  /**
   * Find project with API keys
   */
  async getProjectWithApiKeys(id: string, tenantId: string): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['tenant', 'brand', 'apiKeys'],
    });
  }

  /**
   * Find project with provider configs
   */
  async getProjectWithProviderConfigs(
    id: string,
    tenantId: string,
  ): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['tenant', 'brand', 'providerConfigs'],
    });
  }

  /**
   * Check if a project with the same name exists in the tenant
   */
  async existsByNameAndTenant(
    name: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .where('project.tenantId = :tenantId', { tenantId })
      .andWhere('project.name = :name', { name });

    if (excludeId) {
      queryBuilder.andWhere('project.id != :excludeId', { excludeId });
    }

    const count = await queryBuilder.getCount();
    return count > 0;
  }
}
