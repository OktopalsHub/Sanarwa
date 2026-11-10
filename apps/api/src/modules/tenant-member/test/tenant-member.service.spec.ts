import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotFoundException } from "@nestjs/common";
import { TenantMemberService } from "../tenant-member.service";
import { TenantMember } from "../tenant-member.entity";
import { TENANT_MEMBER_REPO } from "../tenant-member.tokens";
import type { Mocked } from "vitest";

describe("TenantMemberService", () => {
  let service: TenantMemberService;
  let repository: Mocked<any>;

  const member = {
    id: "member-1",
    tenant: { id: "tenant-1" },
    user: { id: "user-1" },
  } as TenantMember;

  beforeEach(async () => {
    repository = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        { provide: TENANT_MEMBER_REPO, useValue: repository },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    service = module.get<TenantMemberService>(TenantMemberService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("removeTenantMember", () => {
    it("should delete an existing member", async () => {
      repository.findOne.mockResolvedValue(member);

      await service.removeTenantMember("tenant-1", "member-1");

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: "member-1", tenant: { id: "tenant-1" } },
      });
      expect(repository.delete).toHaveBeenCalledWith("member-1");
    });

    it("should throw when the member does not exist", async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.removeTenantMember("tenant-1", "missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getMemberByUserId", () => {
    it("should scope the lookup by tenant and user", async () => {
      repository.findOne.mockResolvedValue(member);

      const result = await service.getMemberByUserId("tenant-1", "user-1");

      expect(result).toBe(member);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { tenant: { id: "tenant-1" }, user: { id: "user-1" } },
        relations: { user: true, tenant: true },
      });
    });
  });

  describe("getTenantMembers", () => {
    it("should list the tenant's members", async () => {
      repository.createQueryBuilder.mockReturnValue({
        leftJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[member], 1]),
      } as any);

      const result = await service.getTenantMembers("tenant-1", {} as any);

      expect(result.size).toBe(1);
      expect(result.totalItems).toBe(1);
    });
  });

  describe("getTenantMemberById", () => {
    it("should throw when the member is not in the tenant", async () => {
      repository.createQueryBuilder.mockReturnValue({
        leftJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      } as any);

      await expect(service.getTenantMemberById("tenant-1", "missing")).rejects.toThrow();
    });
  });
});
