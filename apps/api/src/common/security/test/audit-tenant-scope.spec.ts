import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AuditLogService } from "../services/audit-log.service";
import { requireTenantId } from "../require-tenant-id";

const TENANT = "123e4567-e89b-42d3-a456-426614174000";

function serviceWithRepo() {
  const qb = {
    andWhere: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    getMany: vi.fn().mockResolvedValue([]),
  };
  const repo = {
    createQueryBuilder: vi.fn(() => qb),
    find: vi.fn().mockResolvedValue([]),
  };
  return { service: new AuditLogService(repo as never), qb, repo };
}

describe("requireTenantId", () => {
  it("returns a valid UUID", () => {
    expect(requireTenantId(TENANT)).toBe(TENANT);
  });

  it.each([undefined, "", "not-a-uuid", 42])("rejects %s", (value) => {
    expect(() => requireTenantId(value)).toThrow(BadRequestException);
  });
});

describe("AuditLogService tenant scoping", () => {
  it("refuses an unscoped query instead of reading every tenant", async () => {
    const { service, repo } = serviceWithRepo();

    await expect(service.queryAuditLogs({})).rejects.toThrow(BadRequestException);

    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("filters a scoped query by tenant", async () => {
    const { service, qb } = serviceWithRepo();

    await service.queryAuditLogs({ tenantId: TENANT });

    expect(qb.andWhere).toHaveBeenCalledWith("audit.tenantId = :tenantId", { tenantId: TENANT });
  });

  it.each([
    [
      "getResourceAuditLogs",
      (s: AuditLogService) => s.getResourceAuditLogs("", "USER" as never, "r"),
    ],
    ["getUserAuditLogs", (s: AuditLogService) => s.getUserAuditLogs("", "u")],
    ["getAuditLogStats", (s: AuditLogService) => s.getAuditLogStats("")],
    ["getUserActivitySummary", (s: AuditLogService) => s.getUserActivitySummary("", "u")],
  ])("%s rejects an empty tenant", async (_name, call) => {
    const { service, repo } = serviceWithRepo();

    await expect(call(service)).rejects.toThrow(BadRequestException);

    expect(repo.find).not.toHaveBeenCalled();
  });
});
