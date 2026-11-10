import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  IngestQueryDto,
  NotificationTransportController,
} from "../controllers/notification-transport.controller";

describe("GET /notifications/ingest", () => {
  let controller: NotificationTransportController;
  let engine: { send: ReturnType<typeof vi.fn> };

  const apiKey = { tenantId: "tenant-1" } as never;
  const projectId = "project-1";

  beforeEach(() => {
    engine = {
      send: vi.fn().mockResolvedValue({
        id: "log-1",
        trackingId: "track-1",
        messageId: "msg-1",
        status: "sent",
        externalId: "ext-1",
      }),
    };

    controller = new NotificationTransportController({} as never, {} as never, engine as never);
  });

  it("publishes a topic message via the engine (ntfy-style)", async () => {
    const result = await controller.ingest(
      {
        topic: "alerts",
        title: "Disk full",
        message: "prod-1 disk at 98%",
        priority: "high",
        tags: "warning,ops",
      } as IngestQueryDto,
      apiKey,
      projectId,
    );

    expect(result).toMatchObject({ status: "sent", trackingId: "track-1", topic: "alerts" });
    expect(engine.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        projectId,
        to: "alerts",
        message: "prod-1 disk at 98%",
        priority: "high",
        metadata: expect.objectContaining({ source: "ingest", topic: "alerts" }),
      }),
    );
  });

  it("requires a message and a topic or recipient", async () => {
    await expect(
      controller.ingest({ topic: "alerts" } as IngestQueryDto, apiKey, projectId),
    ).rejects.toThrow(/message, text, or body/);

    await expect(
      controller.ingest({ message: "hi" } as IngestQueryDto, apiKey, projectId),
    ).rejects.toThrow(/topic or to/);
  });

  it("rejects invalid JSON data and bad dates", async () => {
    await expect(
      controller.ingest(
        { topic: "alerts", message: "hi", data: "{nope" } as IngestQueryDto,
        apiKey,
        projectId,
      ),
    ).rejects.toThrow(/valid JSON/);

    await expect(
      controller.ingest(
        { topic: "alerts", message: "hi", scheduledAt: "not-a-date" } as IngestQueryDto,
        apiKey,
        projectId,
      ),
    ).rejects.toThrow(/scheduledAt must be a valid ISO date/);
  });
});
