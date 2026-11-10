import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { CampaignService } from "../campaign.service";

const TENANT = "tenant-1";

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    tenantId: TENANT,
    name: "Launch",
    status: "draft",
    channels: [NotificationChannel.EMAIL],
    audience: { type: "topic", topic: "news" },
    schedule: { type: "immediate" },
    templates: [{ templateId: "tmpl-1", subject: "Hi", data: { a: 1 } }],
    analytics: { totalSent: 0 },
    ...overrides,
  };
}

describe("CampaignService.dispatch", () => {
  let repo: { findOne: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let topics: { listSubscribers: ReturnType<typeof vi.fn> };
  let unified: { send: ReturnType<typeof vi.fn> };
  let service: CampaignService;

  beforeEach(() => {
    repo = {
      findOne: vi.fn(),
      save: vi.fn().mockImplementation(async (c) => c),
    };
    topics = { listSubscribers: vi.fn().mockResolvedValue(["u1", "u2", "u3"]) };
    unified = {
      send: vi.fn().mockResolvedValue({ status: "queued", messageId: "m1", deliveries: [] }),
    };
    service = new CampaignService(repo as never, topics as never, unified as never);
  });

  it("fans out a topic campaign via unified send and completes it", async () => {
    repo.findOne.mockResolvedValue(makeCampaign());

    const result = await service.dispatch(TENANT, "camp-1");

    expect(topics.listSubscribers).toHaveBeenCalledWith(TENANT, "news");
    expect(unified.send).toHaveBeenCalledTimes(3);
    expect(unified.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "u1",
        channels: [NotificationChannel.EMAIL],
        templateId: "tmpl-1",
        metadata: expect.objectContaining({ campaignId: "camp-1" }),
        variables: expect.objectContaining({ campaignId: "camp-1", campaignName: "Launch" }),
      }),
      TENANT,
    );
    expect(result).toMatchObject({ targeted: 3, queued: 3, failed: 0, status: "completed" });
  });

  it("fans out an explicit subscriber list and dedupes ids", async () => {
    repo.findOne.mockResolvedValue(
      makeCampaign({ audience: { type: "list", subscriberIds: ["a", "b", "a", " "] } }),
    );

    const result = await service.dispatch(TENANT, "camp-1");

    expect(topics.listSubscribers).not.toHaveBeenCalled();
    expect(unified.send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ targeted: 2, queued: 2 });
  });

  it("marks a future campaign as scheduled and passes scheduledAt", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    repo.findOne.mockResolvedValue(makeCampaign({ schedule: { scheduledAt: future } }));

    const result = await service.dispatch(TENANT, "camp-1");

    expect(result.status).toBe("scheduled");
    expect(unified.send).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: future }),
      TENANT,
    );
  });

  it("rejects unsafe or invalid audiences and missing content", async () => {
    repo.findOne.mockResolvedValue(makeCampaign({ audience: { type: "all" } }));
    await expect(service.dispatch(TENANT, "camp-1")).rejects.toBeInstanceOf(BadRequestException);

    repo.findOne.mockResolvedValue(makeCampaign({ audience: { type: "segment", id: "x" } }));
    await expect(service.dispatch(TENANT, "camp-1")).rejects.toThrow(/Unsupported audience/);

    repo.findOne.mockResolvedValue(makeCampaign({ templates: [{}] }));
    await expect(service.dispatch(TENANT, "camp-1")).rejects.toThrow(/templateId or data/);

    repo.findOne.mockResolvedValue(makeCampaign({ status: "completed" }));
    await expect(service.dispatch(TENANT, "camp-1")).rejects.toThrow(/cannot be dispatched/);
  });
});
