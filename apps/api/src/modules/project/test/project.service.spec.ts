import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Mock } from "vitest";
import { Repository } from "typeorm";
import { Project, ProjectStatus } from "../../../database/entities/project.entity";
import { TenantFactory } from "../../test/factories/tenant.factory";
import { ProjectService } from "./project.service";

describe("ProjectService", () => {
  let service: ProjectService;
  let projectRepository: Repository<Project>;

  const mockProjectRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    createQueryBuilder: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
      getOne: vi.fn(),
      getManyAndCount: vi.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    projectRepository = module.get<Repository<Project>>(getRepositoryToken(Project));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createProject", () => {
    it("should create a new project successfully", async () => {
      const tenant = TenantFactory.create();
      const projectData = {
        name: "Test Project",
        description: "Test project description",
        settings: {
          defaultFromEmail: "noreply@testproject.com",
          defaultFromName: "Test Project",
        },
      };

      const mockProject = {
        id: "project-1",
        tenantId: tenant.id,
        name: projectData.name,
        description: projectData.description,
        status: ProjectStatus.ACTIVE,
        settings: projectData.settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProjectRepository.create.mockReturnValue(mockProject);
      mockProjectRepository.save.mockResolvedValue(mockProject);

      const result = await service.createProject(tenant.id, projectData);

      expect(mockProjectRepository.create).toHaveBeenCalledWith({
        tenantId: tenant.id,
        name: projectData.name,
        description: projectData.description,
        status: ProjectStatus.ACTIVE,
        settings: projectData.settings,
      });
      expect(mockProjectRepository.save).toHaveBeenCalledWith(mockProject);
      expect(result).toEqual(mockProject);
    });

    it("should create project with default settings when not provided", async () => {
      const tenant = TenantFactory.create();
      const projectData = {
        name: "Test Project",
        description: "Test project description",
      };

      const mockProject = {
        id: "project-1",
        tenantId: tenant.id,
        name: projectData.name,
        description: projectData.description,
        status: ProjectStatus.ACTIVE,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProjectRepository.create.mockReturnValue(mockProject);
      mockProjectRepository.save.mockResolvedValue(mockProject);

      const result = await service.createProject(tenant.id, projectData);

      expect(mockProjectRepository.create).toHaveBeenCalledWith({
        tenantId: tenant.id,
        name: projectData.name,
        description: projectData.description,
        status: ProjectStatus.ACTIVE,
        settings: {},
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe("getProjectsByTenant", () => {
    it("should return all projects for a tenant", async () => {
      const tenant = TenantFactory.create();
      const mockProjects = [
        { id: "project-1", name: "Project 1", tenantId: tenant.id },
        { id: "project-2", name: "Project 2", tenantId: tenant.id },
      ];

      mockProjectRepository.find.mockResolvedValue(mockProjects);

      const result = await service.getProjectsByTenant(tenant.id);

      expect(mockProjectRepository.find).toHaveBeenCalledWith({
        where: { tenantId: tenant.id },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(mockProjects);
    });

    it("should filter projects by status when provided", async () => {
      const tenant = TenantFactory.create();
      const status = ProjectStatus.ACTIVE;
      const mockProjects = [{ id: "project-1", name: "Project 1", tenantId: tenant.id, status }];

      mockProjectRepository.find.mockResolvedValue(mockProjects);

      const result = await service.getProjectsByTenant(tenant.id, status);

      expect(mockProjectRepository.find).toHaveBeenCalledWith({
        where: { tenantId: tenant.id, status },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(mockProjects);
    });
  });

  describe("getProjectById", () => {
    it("should return project when found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";
      const mockProject = {
        id: projectId,
        name: "Test Project",
        tenantId: tenant.id,
      };

      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.getProjectById(tenant.id, projectId);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, tenantId: tenant.id },
      });
      expect(result).toEqual(mockProject);
    });

    it("should return null when project not found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "non-existent";

      mockProjectRepository.findOne.mockResolvedValue(null);

      const result = await service.getProjectById(tenant.id, projectId);

      expect(result).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("should update project successfully", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";
      const updateData = {
        name: "Updated Project",
        description: "Updated description",
        settings: {
          defaultFromEmail: "updated@test.com",
        },
      };

      const existingProject = {
        id: projectId,
        tenantId: tenant.id,
        name: "Old Project",
        status: ProjectStatus.ACTIVE,
      };

      const updatedProject = { ...existingProject, ...updateData };

      mockProjectRepository.findOne.mockResolvedValue(existingProject);
      mockProjectRepository.save.mockResolvedValue(updatedProject);

      const result = await service.updateProject(tenant.id, projectId, updateData);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, tenantId: tenant.id },
      });
      expect(mockProjectRepository.save).toHaveBeenCalledWith(updatedProject);
      expect(result).toEqual(updatedProject);
    });

    it("should throw error when project not found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "non-existent";
      const updateData = { name: "Updated Project" };

      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.updateProject(tenant.id, projectId, updateData)).rejects.toThrow(
        "Project not found",
      );
    });
  });

  describe("deleteProject", () => {
    it("should delete project successfully", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";

      const existingProject = {
        id: projectId,
        tenantId: tenant.id,
        status: ProjectStatus.ACTIVE,
      };

      mockProjectRepository.findOne.mockResolvedValue(existingProject);
      mockProjectRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteProject(tenant.id, projectId);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, tenantId: tenant.id },
      });
      expect(mockProjectRepository.delete).toHaveBeenCalledWith(projectId);
    });

    it("should throw error when project not found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "non-existent";

      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteProject(tenant.id, projectId)).rejects.toThrow(
        "Project not found",
      );
    });
  });

  describe("getProjectStats", () => {
    it("should return project statistics", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";

      const existingProject = {
        id: projectId,
        tenantId: tenant.id,
        status: ProjectStatus.ACTIVE,
      };

      // Mock statistics data
      const mockStats = {
        totalNotifications: 100,
        totalTemplates: 5,
        totalBrands: 2,
        notificationsByChannel: {
          email: 60,
          sms: 30,
          push: 10,
        },
        deliveryRates: {
          overall: 95.5,
          email: 98.0,
          sms: 92.0,
          push: 88.0,
        },
      };

      mockProjectRepository.findOne.mockResolvedValue(existingProject);

      // Mock the query builder for statistics
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { channel: "email", count: "60" },
          { channel: "sms", count: "30" },
          { channel: "push", count: "10" },
        ]),
      };

      mockProjectRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getProjectStats(tenant.id, projectId);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, tenantId: tenant.id },
      });
      expect(result).toBeDefined();
      expect(result.project).toEqual(existingProject);
    });

    it("should throw error when project not found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "non-existent";

      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.getProjectStats(tenant.id, projectId)).rejects.toThrow(
        "Project not found",
      );
    });
  });

  describe("archiveProject", () => {
    it("should archive project successfully", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";

      const existingProject = {
        id: projectId,
        tenantId: tenant.id,
        status: ProjectStatus.ACTIVE,
      };

      const archivedProject = {
        ...existingProject,
        status: ProjectStatus.ARCHIVED,
      };

      mockProjectRepository.findOne.mockResolvedValue(existingProject);
      mockProjectRepository.save.mockResolvedValue(archivedProject);

      const result = await service.archiveProject(tenant.id, projectId);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, tenantId: tenant.id },
      });
      expect(mockProjectRepository.save).toHaveBeenCalledWith(archivedProject);
      expect(result.status).toBe(ProjectStatus.ARCHIVED);
    });

    it("should throw error when project not found", async () => {
      const tenant = TenantFactory.create();
      const projectId = "non-existent";

      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.archiveProject(tenant.id, projectId)).rejects.toThrow(
        "Project not found",
      );
    });

    it("should throw error when project is already archived", async () => {
      const tenant = TenantFactory.create();
      const projectId = "project-1";

      const archivedProject = {
        id: projectId,
        tenantId: tenant.id,
        status: ProjectStatus.ARCHIVED,
      };

      mockProjectRepository.findOne.mockResolvedValue(archivedProject);

      await expect(service.archiveProject(tenant.id, projectId)).rejects.toThrow(
        "Project is already archived",
      );
    });
  });
});
