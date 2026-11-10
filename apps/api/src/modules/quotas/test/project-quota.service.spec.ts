import { describe, expect, it, vi, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MessageDelivery } from "../../messaging/message-delivery.entity";
import { ProjectSendQuota } from "../entities/project-send-quota.entity";
import { ProjectQuotaService } from "../project-quota.service";

const TENANT = "tenant-1";
const PROJECT = "project-1";
const NOW = new Date("2026-11-09T22:30:00.000Z");

function countBuilder(count: number) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(count),
  };
}

describe("ProjectQuotaService", () => {
  let service: ProjectQuotaService;
  let quotas: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let deliveries: { createQueryBuilder: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    quotas = {
      findOne: vi.fn(),
      save: vi.fn().mockImplementation((value) => value),
      create: vi.fn().mockImplementation((value) => value),
      delete: vi.fn(),
    };
    deliveries = { createQueryBuilder: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ProjectQuotaService,
        { provide: getRepositoryToken(ProjectSendQuota), useValue: quotas },
        { provide: getRepositoryToken(MessageDelivery), useValue: deliveries },
      ],
    }).compile();

    service = module.get(ProjectQuotaService);
  });

  it("allows sends when no quota row exists (unbounded default)", async () => {
    quotas.findOne.mockResolvedValue(null);

    await expect(
      service.checkQuota({ tenantId: TENANT, projectId: PROJECT, now: NOW }),
    ).resolves.toEqual({ allowed: true, quota: null });
    expect(deliveries.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("allows sends when quota is disabled or belongs to another tenant", async () => {
    quotas.findOne.mockResolvedValue({ projectId: PROJECT, tenantId: TENANT, enabled: false });

    await expect(
      service.checkQuota({ tenantId: TENANT, projectId: PROJECT, now: NOW }),
    ).resolves.toMatchObject({ allowed: true });

    quotas.findOne.mockResolvedValue({ projectId: PROJECT, tenantId: "other", enabled: true });
    await expect(
      service.checkQuota({ tenantId: TENANT, projectId: PROJECT, now: NOW }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("allows under the limit and blocks at the limit with a reset time", async () => {
    quotas.findOne.mockResolvedValue({
      projectId: PROJECT,
      tenantId: TENANT,
      enabled: true,
      limit: 2,
      windowSeconds: 60,
    });
    deliveries.createQueryBuilder.mockReturnValue(countBuilder(1));

    await expect(
      service.checkQuota({ tenantId: TENANT, projectId: PROJECT, now: NOW }),
    ).resolves.toMatchObject({ allowed: true });

    deliveries.createQueryBuilder.mockReturnValue(countBuilder(2));
    await expect(
      service.checkQuota({ tenantId: TENANT, projectId: PROJECT, now: NOW }),
    ).resolves.toEqual({
      allowed: false,
      reason: "project_quota",
      used: 2,
      limit: 2,
      windowSeconds: 60,
      resetAt: new Date(NOW.getTime() + 60_000),
    });
  });

  it("excludes the delivery being retried from the count", async () => {
    quotas.findOne.mockResolvedValue({
      projectId: PROJECT,
      tenantId: TENANT,
      enabled: true,
      limit: 1,
      windowSeconds: 60,
    });
    const builder = countBuilder(0);
    deliveries.createQueryBuilder.mockReturnValue(builder);

    await service.checkQuota({
      tenantId: TENANT,
      projectId: PROJECT,
      excludeDeliveryId: "delivery-1",
      now: NOW,
    });

    expect(builder.andWhere).toHaveBeenCalledWith("delivery.id != :excludeDeliveryId", {
      excludeDeliveryId: "delivery-1",
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("projectId"),
      expect.anything(),
    );
  });

  it("reports unbounded status and remaining after upsert", async () => {
    quotas.findOne.mockResolvedValue(null);
    await expect(service.getStatus(PROJECT, TENANT)).resolves.toMatchObject({
      configured: false,
      remaining: null,
    });

    quotas.findOne.mockResolvedValue({
      projectId: PROJECT,
      tenantId: TENANT,
      enabled: true,
      limit: 10,
      windowSeconds: 60,
    });
    deliveries.createQueryBuilder.mockReturnValue(countBuilder(3));

    await expect(service.getStatus(PROJECT, TENANT)).resolves.toMatchObject({
      configured: true,
      limit: 10,
      used: 3,
      remaining: 7,
    });

    await service.upsertQuota({
      tenantId: TENANT,
      projectId: PROJECT,
      limit: 5,
      windowSeconds: 30,
    });
    expect(quotas.save).toHaveBeenCalled();
  });
});
