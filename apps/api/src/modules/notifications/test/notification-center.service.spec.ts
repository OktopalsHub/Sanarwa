import { describe, expect, it, vi } from "vitest";
import { InAppNotificationStatus } from "../../messaging/entities/in-app-notification.entity";
import { NotificationCenterService } from "../services/notification-center.service";
import { NotificationCenterStatus } from "../services/notification-center.types";

const TENANT = "tenant-1";
const SUBSCRIBER = "subscriber-1";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "n-1",
    tenantId: TENANT,
    subscriberId: SUBSCRIBER,
    title: "Hello",
    message: "World",
    type: "info",
    status: InAppNotificationStatus.DELIVERED,
    category: "inbox",
    channel: "in_app",
    messageId: "msg-1",
    feedId: "default",
    seen: false,
    archived: false,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    ...overrides,
  } as never;
}

function build() {
  const repository = {
    findOne: vi.fn().mockResolvedValue(null),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ ...value, id: value.id ?? "n-1" })),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    count: vi.fn().mockResolvedValue(0),
    query: vi.fn().mockResolvedValue([]),
  };

  const service = new NotificationCenterService(repository as never);

  return { service, repository };
}

describe("NotificationCenterService mapping", () => {
  it("maps a delivered row to an unread item", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row());

    const item = await service.getNotification("n-1", TENANT);

    expect(item.status).toBe(NotificationCenterStatus.UNREAD);
    expect(item.data).toBe("World");
    expect(item.messageId).toBe("msg-1");
  });

  it("maps a read row to a read item", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row({ readAt: new Date(), status: "read" }));

    const item = await service.getNotification("n-1", TENANT);

    expect(item.status).toBe(NotificationCenterStatus.READ);
  });

  it("maps an archived row to an archived item", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row({ archived: true, archivedAt: new Date() }));

    const item = await service.getNotification("n-1", TENANT);

    expect(item.status).toBe(NotificationCenterStatus.ARCHIVED);
  });

  it("merges data and metadata and prefers metadata for description", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(
      row({ data: { source: "seed" }, metadata: { description: "full text" } }),
    );

    const item = await service.getNotification("n-1", TENANT);

    expect(item.description).toBe("full text");
    expect(item.metadata).toEqual({ source: "seed", description: "full text" });
  });
});

describe("NotificationCenterService inbound email items", () => {
  it("persists an inbound reply without a subscriber", async () => {
    const { service, repository } = build();

    const item = await service.upsertInboundItem({
      tenantId: TENANT,
      title: "Re: order",

      data: "reply body",
      channel: "email",
      messageId: "<abc@example.com>",
      threadId: "thread-1",
    });

    const createArg = repository.create.mock.calls[0][0] as Record<string, unknown>;
    expect(createArg.subscriberId).toBeUndefined();
    expect(createArg.channel).toBe("email");
    expect(createArg.messageId).toBe("<abc@example.com>");
    expect(item.status).toBe(NotificationCenterStatus.UNREAD);
  });

  it("updates an existing inbound item on a repeated message-id", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row({ messageId: "<abc@example.com>" }));

    await service.upsertInboundItem({
      tenantId: TENANT,
      title: "Re: order",

      data: "updated body",
      channel: "email",
      messageId: "<abc@example.com>",
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ message: "updated body" }),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("NotificationCenterService reads and writes", () => {
  it("feed applies status filters and maps rows", async () => {
    const { service, repository } = build();
    repository.findAndCount.mockResolvedValue([[row()], 1]);

    const page = await service.getNotificationFeed(
      SUBSCRIBER,
      TENANT,
      1,
      20,
      NotificationCenterStatus.UNREAD,
    );

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriberId: SUBSCRIBER,
          tenantId: TENANT,
          archived: false,
        }),
        skip: 0,
        take: 20,
      }),
    );
    expect(page.records).toHaveLength(1);
    expect(page.totalItems).toBe(1);
  });

  it("markAsRead sets readAt and the read status", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row());

    await service.markAsRead("n-1", TENANT);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ readAt: expect.any(Date), status: InAppNotificationStatus.READ }),
    );
  });

  it("archiveNotification sets the archived flag", async () => {
    const { service, repository } = build();
    repository.findOne.mockResolvedValue(row());

    await service.archiveNotification("n-1", TENANT);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, archivedAt: expect.any(Date) }),
    );
  });

  it("getUnreadCount counts unread and non-archived rows", async () => {
    const { service, repository } = build();
    repository.count.mockResolvedValue(7);

    const count = await service.getUnreadCount(SUBSCRIBER, TENANT);

    expect(count).toBe(7);
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archived: false, subscriberId: SUBSCRIBER }),
      }),
    );
  });

  it("deleteNotification throws for a missing row", async () => {
    const { service, repository } = build();
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.deleteNotification("missing", TENANT)).rejects.toThrow();
  });

  it("searchNotifications maps raw query rows onto the item shape", async () => {
    const { service, repository } = build();
    repository.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([{ count: 1 }]);

    const page = await service.searchNotifications(SUBSCRIBER, TENANT, "order", 1, 10);

    expect(page.records).toHaveLength(1);
    expect(page.totalItems).toBe(1);
  });

  it("searchNotifications projects the columns to the camelCase item shape and excludes archived rows", async () => {
    const { service, repository } = build();
    repository.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([{ count: 1 }]);

    await service.searchNotifications(SUBSCRIBER, TENANT, "order", 1, 10);

    const [sql] = repository.query.mock.calls[0];
    expect(sql).toContain('tenant_id AS "tenantId"');
    expect(sql).toContain('read_at AS "readAt"');
    expect(sql).toContain('message_id AS "messageId"');
    expect(sql).toContain('delivery_id AS "deliveryId"');
    expect(sql).toContain("archived = false");
  });
});
