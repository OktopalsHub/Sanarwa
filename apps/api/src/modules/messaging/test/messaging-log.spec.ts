import { describe, expect, it, vi } from "vitest";
import { applyMessageLogFilters, mapLogsToMessageListRecords } from "../message-log.query";

function mockQueryBuilder() {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
  };
}

describe("message log list filters", () => {
  it("filters notification_logs by channel, status, project, and search", () => {
    const qb = mockQueryBuilder();
    applyMessageLogFilters(
      qb,
      {
        channel: "email",
        status: "delivered",
        projectId: "proj-1",
        q: "amaka",
      },
      "tenant-1",
    );

    expect(qb.where).toHaveBeenCalledWith("log.tenantId = :tenantId", {
      tenantId: "tenant-1",
    });
    expect(qb.andWhere).toHaveBeenCalledWith("log.channel = :channel", {
      channel: "email",
    });
    expect(qb.andWhere).toHaveBeenCalledWith("log.status = :status", {
      status: "delivered",
    });
    expect(qb.andWhere).toHaveBeenCalledWith("log.projectId = :projectId", {
      projectId: "proj-1",
    });
    expect(qb.andWhere).toHaveBeenCalledWith("(log.to ILIKE :q OR log.trackingId ILIKE :q)", {
      q: "%amaka%",
    });
  });

  it("joins optional message subject and content", () => {
    const records = mapLogsToMessageListRecords(
      [
        {
          id: "log-1",
          trackingId: "trk_1",
          channel: "email",
          to: "amaka@halo.ng",
          status: "delivered",
          projectId: "proj-1",
          metadata: { messageId: "msg-1" },
          createdAt: new Date("2026-08-01T10:00:00Z"),
        },
      ],
      [{ id: "msg-1", subject: "Receipt for ₦45,000", content: "<p>Thanks</p>" }],
    );

    expect(records[0]).toMatchObject({
      id: "log-1",
      to: "amaka@halo.ng",
      subject: "Receipt for ₦45,000",
      hasContent: true,
    });
  });
});
