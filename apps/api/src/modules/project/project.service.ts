import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { getPaginationSummary, IPaginatedData } from 'src/common/dto/pagination.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) { }

  async createProject(
    tenantId: string,
    createDto: CreateProjectDto,
    createdById?: string,
  ): Promise<Project> {
    // Check if a project with the same name already exists in this tenant
    const exists = await this.projectRepository.existsByNameAndTenant(
      createDto.name,
      tenantId,
    );

    if (exists) {
      throw new ConflictException(
        `A project with the name "${createDto.name}" already exists in this tenant`,
      );
    }

    return this.projectRepository.create({
      ...createDto,
      tenant: { id: tenantId },
      ...(createdById && { createdBy: { id: createdById } }),
    });
  }

  async getAllProjects(
    tenantId: string,
    query?: any,
  ): Promise<IPaginatedData<Partial<Project>>> {
    const queryBuilder = this.projectRepository
      .createQueryBuilder('project')
      .select([
        'project.id',
        'project.name',
        'project.description',
        'project.status',
        'project.createdAt',
        'project.updatedAt',
      ])
      .where('project.tenant.id = :tenantId', { tenantId });

    // Apply filters
    if (query?.search) {
      queryBuilder.andWhere(
        '(project.name ILIKE :search OR project.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Apply sorting
    const sortField = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder || 'DESC';
    queryBuilder.orderBy(`project.${sortField}`, sortOrder);

    // Apply pagination
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [projects, total] = await queryBuilder.getManyAndCount();

    // Transform to only include necessary fields
    const sanitizedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status
    }));

    return getPaginationSummary(
      sanitizedProjects,
      total,
      { page, limit },
      'projects',
    );
  }

  async getProjectById(tenantId: string, id: string): Promise<Project> {
    const project = await this.projectRepository.findByIdAndTenant(
      id,
      tenantId,
    );

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async updateProject(
    tenantId: string,
    id: string,
    updateDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.getProjectById(tenantId, id);

    // Check if updating the name would create a duplicate
    if (updateDto.name && updateDto.name !== project.name) {
      const exists = await this.projectRepository.existsByNameAndTenant(
        updateDto.name,
        tenantId,
        id,
      );

      if (exists) {
        throw new ConflictException(
          `A project with the name "${updateDto.name}" already exists in this tenant`,
        );
      }
    }

    const updatedProject = await this.projectRepository.update(id, updateDto);

    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return updatedProject;
  }

  async deleteProject(tenantId: string, id: string): Promise<void> {
    const project = await this.getProjectById(tenantId, id);
    await this.projectRepository.delete(project.id);
  }
}
