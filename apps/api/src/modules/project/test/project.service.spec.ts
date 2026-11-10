import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ProjectStatus } from "../../../common/enums";
import { Project } from "../entities/project.entity";
import { ProjectRepository } from "../project.repository";
import { ProjectService } from "../project.service";

type ProjectRow = Pick<
  Project,
  "id" | "name" | "description" | "status" | "createdAt" | "updatedAt"
>;

describe("ProjectService", () => {
  let service: ProjectService;

  const projectRepository = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByIdAndTenant: vi.fn(),
    existsByNameAndTenant: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const projectRow = (overrides: Partial<ProjectRow> = {}): ProjectRow => ({
    id: "project-1",
    name: "Test Project",
    description: "A test project",
    status: ProjectStatus.ACTIVE,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    ...overrides,
  });

  const paginatedBuilder = (allRows: ProjectRow[], total: number) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
    };
    builder.getManyAndCount = vi.fn(() => {
      const offset = builder.skip.mock.calls.at(-1)?.[0] ?? 0;
      const limit = builder.take.mock.calls.at(-1)?.[0] ?? allRows.length;
      return Promise.resolve([allRows.slice(offset, offset + limit), total]);
    });
    projectRepository.createQueryBuilder.mockReturnValue(builder);
    return builder;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectService, { provide: ProjectRepository, useValue: projectRepository }],
    }).compile();

    service = module.get(ProjectService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("is defined", () => {
    expect(service).toBeDefined();
  });

  describe("createProject", () => {
    it("stores the project against its tenant and creator", async () => {
      projectRepository.existsByNameAndTenant.mockResolvedValue(false);
      projectRepository.create.mockResolvedValue(projectRow());

      const created = await service.createProject(
        "tenant-1",
        { name: "Test Project", description: "A test project" },
        "member-1",
      );

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: "Test Project",
        description: "A test project",
        tenant: { id: "tenant-1" },
        createdBy: { id: "member-1" },
      });
      expect(created.id).toBe("project-1");
    });

    it("leaves createdBy off when no member is given", async () => {
      projectRepository.existsByNameAndTenant.mockResolvedValue(false);
      projectRepository.create.mockResolvedValue(projectRow());

      await service.createProject("tenant-1", { name: "Test Project" });

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: "Test Project",
        tenant: { id: "tenant-1" },
      });
    });

    it("rejects a second project with the same name in the tenant", async () => {
      projectRepository.existsByNameAndTenant.mockResolvedValue(true);

      await expect(service.createProject("tenant-1", { name: "Taken" })).rejects.toThrow(
        ConflictException,
      );
      expect(projectRepository.create).not.toHaveBeenCalled();
    });

    it("scopes the name check to the tenant", async () => {
      projectRepository.existsByNameAndTenant.mockResolvedValue(false);
      projectRepository.create.mockResolvedValue(projectRow());

      await service.createProject("tenant-2", { name: "Test Project" });

      expect(projectRepository.existsByNameAndTenant).toHaveBeenCalledWith(
        "Test Project",
        "tenant-2",
      );
    });
  });

  describe("getAllProjects", () => {
    it("returns the page with tenant-visible fields only", async () => {
      const builder = paginatedBuilder([projectRow()], 1);

      const result = await service.getAllProjects("tenant-1");

      expect(projectRepository.createQueryBuilder).toHaveBeenCalledWith("project");
      expect(builder.select).toHaveBeenCalled();
      expect(builder.take).toHaveBeenCalledWith(10);
      expect(builder.skip).toHaveBeenCalledWith(0);
      expect(result).toMatchObject({ name: "projects", page: 1, limit: 10, totalItems: 1 });
      expect(Object.keys(result.records[0]).sort()).toEqual([
        "description",
        "id",
        "name",
        "status",
      ]);
    });

    it("windows the requested page and reports its neighbours", async () => {
      const rows = Array.from({ length: 12 }, (_, index) => projectRow({ id: `project-${index}` }));
      const builder = paginatedBuilder(rows, 12);

      const result = await service.getAllProjects("tenant-1", { page: 2, limit: 5 });

      expect(builder.skip).toHaveBeenCalledWith(5);
      expect(builder.take).toHaveBeenCalledWith(5);
      expect(result).toMatchObject({
        page: 2,
        limit: 5,
        pageCount: 3,
        totalItems: 12,
        previousPage: 1,
        nextPage: 3,
      });
      expect(result.size).toBe(5);
      expect(result.records.map((row) => row.id)).toEqual([
        "project-5",
        "project-6",
        "project-7",
        "project-8",
        "project-9",
      ]);
    });

    it("clamps previousPage when the page sits past the last one", async () => {
      paginatedBuilder([], 0);

      const result = await service.getAllProjects("tenant-1", { page: 3, limit: 5 });

      expect(result).toMatchObject({ pageCount: 1, previousPage: 1, nextPage: null });
    });

    it("adds a search predicate only when a search is given", async () => {
      const withSearch = paginatedBuilder([], 0);

      await service.getAllProjects("tenant-1", { search: "payments" });

      expect(withSearch.andWhere).toHaveBeenCalledWith(
        "(project.name ILIKE :search OR project.description ILIKE :search)",
        { search: "%payments%" },
      );

      const withoutSearch = paginatedBuilder([], 0);

      await service.getAllProjects("tenant-1");

      expect(withoutSearch.andWhere).not.toHaveBeenCalled();
    });

    it("orders by the requested column and defaults to newest first", async () => {
      const sorted = paginatedBuilder([], 0);

      await service.getAllProjects("tenant-1", { sortBy: "name", sortOrder: "ASC" });

      expect(sorted.orderBy).toHaveBeenCalledWith("project.name", "ASC");

      const unsorted = paginatedBuilder([], 0);

      await service.getAllProjects("tenant-1");

      expect(unsorted.orderBy).toHaveBeenCalledWith("project.createdAt", "DESC");
    });

    it("keeps the tenant predicate on every read", async () => {
      const builder = paginatedBuilder([], 0);

      await service.getAllProjects("tenant-9", { search: "x" });

      expect(builder.where).toHaveBeenCalledWith("project.tenant.id = :tenantId", {
        tenantId: "tenant-9",
      });
    });
  });

  describe("getProjectById", () => {
    it("reads the project scoped to the tenant", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow());

      const project = await service.getProjectById("tenant-1", "project-1");

      expect(projectRepository.findByIdAndTenant).toHaveBeenCalledWith("project-1", "tenant-1");
      expect(project.id).toBe("project-1");
    });

    it("throws not found when the project belongs to another tenant", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(null);

      await expect(service.getProjectById("tenant-2", "project-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateProject", () => {
    it("updates without a name check when the name is unchanged", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow());
      projectRepository.update.mockResolvedValue(projectRow({ description: "Rewritten" }));

      const updated = await service.updateProject("tenant-1", "project-1", {
        name: "Test Project",
        description: "Rewritten",
      });

      expect(projectRepository.existsByNameAndTenant).not.toHaveBeenCalled();
      expect(projectRepository.update).toHaveBeenCalledWith("project-1", {
        name: "Test Project",
        description: "Rewritten",
      });
      expect(updated.description).toBe("Rewritten");
    });

    it("checks the new name against the tenant, excluding this project", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow());
      projectRepository.existsByNameAndTenant.mockResolvedValue(false);
      projectRepository.update.mockResolvedValue(projectRow({ name: "Renamed" }));

      await service.updateProject("tenant-1", "project-1", { name: "Renamed" });

      expect(projectRepository.existsByNameAndTenant).toHaveBeenCalledWith(
        "Renamed",
        "tenant-1",
        "project-1",
      );
    });

    it("rejects a name already taken by another project in the tenant", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow());
      projectRepository.existsByNameAndTenant.mockResolvedValue(true);

      await expect(
        service.updateProject("tenant-1", "project-1", { name: "Taken" }),
      ).rejects.toThrow(ConflictException);
      expect(projectRepository.update).not.toHaveBeenCalled();
    });

    it("throws not found when the project belongs to another tenant", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(null);

      await expect(
        service.updateProject("tenant-2", "project-1", { name: "Yours" }),
      ).rejects.toThrow(NotFoundException);
      expect(projectRepository.update).not.toHaveBeenCalled();
    });

    it("throws not found when the row disappears between the read and the write", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow());
      projectRepository.existsByNameAndTenant.mockResolvedValue(false);
      projectRepository.update.mockResolvedValue(null);

      await expect(
        service.updateProject("tenant-1", "project-1", { name: "Gone" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteProject", () => {
    it("deletes the project it just read back", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(projectRow({ id: "project-7" }));
      projectRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteProject("tenant-1", "project-7");

      expect(projectRepository.delete).toHaveBeenCalledWith("project-7");
    });

    it("deletes nothing when the project belongs to another tenant", async () => {
      projectRepository.findByIdAndTenant.mockResolvedValue(null);

      await expect(service.deleteProject("tenant-2", "project-7")).rejects.toThrow(
        NotFoundException,
      );
      expect(projectRepository.delete).not.toHaveBeenCalled();
    });
  });
});
