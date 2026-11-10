import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { PreferencesService } from "../preferences.service";
import { SubscriberErasureService } from "../subscriber-erasure.service";

const TENANT = "tenant-1";
const SUBSCRIBER = "subscriber-1";

function build() {
  const preferences = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: "pref-1", ...value })),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const suppressions = {
    findOne: vi.fn().mockResolvedValue(null),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: "sup-1", ...value })),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const quietHours = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: "qh-1", ...value })),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const topicSubQb = {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 0 }),
  };
  const topics = {};
  const topicSubscriptions = { createQueryBuilder: vi.fn(() => topicSubQb) };
  const deviceRegistrations = { delete: vi.fn().mockResolvedValue({ affected: 0 }) };
  const messageQb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
  };
  const messages = {
    createQueryBuilder: vi.fn(() => messageQb),
    save: vi.fn(async (value) => value),
  };
  const messageDeliveries = {
    find: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
  };
  const deliveryEvents = { delete: vi.fn().mockResolvedValue({ affected: 0 }) };
  const notificationLogsQb = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 0 }),
  };
  const notificationLogs = { createQueryBuilder: vi.fn(() => notificationLogsQb) };
  const deadLetterQb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
  };
  const deadLetters = {
    createQueryBuilder: vi.fn(() => deadLetterQb),
    save: vi.fn(async (v) => v),
  };

  const erasure = new SubscriberErasureService(
    preferences as never,
    suppressions as never,
    quietHours as never,
    topicSubscriptions as never,
    deviceRegistrations as never,
    messages as never,
    messageDeliveries as never,
    deliveryEvents as never,
    notificationLogs as never,
    deadLetters as never,
  );

  const service = new PreferencesService(
    preferences as never,
    suppressions as never,
    quietHours as never,
    erasure as never,
  );

  return {
    service,
    erasure,
    preferences,
    suppressions,
    quietHours,
    topicSubscriptions,
    topicSubQb,
    deviceRegistrations,
    messages,
    messageQb,
    messageDeliveries,
    deliveryEvents,
    notificationLogs,
    notificationLogsQb,
    deadLetters,
    deadLetterQb,
  };
}

describe("PreferencesService channel preferences", () => {
  it("defaults every channel to enabled when nothing is stored", async () => {
    const { service } = build();

    const result = await service.getSubscriberPreferences(TENANT, SUBSCRIBER);

    expect(result.preferences).toEqual(
      Object.fromEntries(Object.values(NotificationChannel).map((channel) => [channel, true])),
    );
    expect(result.quietHours).toBeNull();
  });

  it("maps stored rows over the defaults", async () => {
    const { service, preferences } = build();
    preferences.find.mockResolvedValue([
      { channel: NotificationChannel.SMS, enabled: false },
      { channel: NotificationChannel.PUSH, enabled: false },
    ]);

    const result = await service.getSubscriberPreferences(TENANT, SUBSCRIBER);

    expect(result.preferences[NotificationChannel.SMS]).toBe(false);
    expect(result.preferences[NotificationChannel.PUSH]).toBe(false);
    expect(result.preferences[NotificationChannel.EMAIL]).toBe(true);
  });

  it("creates a preference row when none exists and updates it on the next call", async () => {
    const { service, preferences } = build();

    await service.setChannelEnabled(TENANT, SUBSCRIBER, NotificationChannel.EMAIL, false);
    expect(preferences.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, subscriberId: SUBSCRIBER, enabled: false }),
    );

    preferences.findOne.mockResolvedValue({
      id: "pref-1",
      tenantId: TENANT,
      subscriberId: SUBSCRIBER,
      channel: NotificationChannel.EMAIL,
      enabled: false,
    });
    await service.setChannelEnabled(TENANT, SUBSCRIBER, NotificationChannel.EMAIL, true);
    expect(preferences.save).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  });
});

describe("PreferencesService quiet hours", () => {
  it("creates quiet hours for a subscriber", async () => {
    const { service, quietHours } = build();

    await service.setQuietHours(TENANT, SUBSCRIBER, {
      enabled: true,
      timezone: "Europe/Berlin",
      startMinute: 1320,
      endMinute: 420,
    });

    expect(quietHours.create).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "Europe/Berlin", startMinute: 1320 }),
    );
  });

  it("rejects an unknown IANA timezone", async () => {
    const { service } = build();

    await expect(
      service.setQuietHours(TENANT, SUBSCRIBER, {
        enabled: true,
        timezone: "Mars/Olympus-Mons",
        startMinute: 0,
        endMinute: 420,
      }),
    ).rejects.toThrow();
  });

  it("throws when deleting quiet hours that do not exist", async () => {
    const { service, quietHours } = build();
    quietHours.delete.mockResolvedValue({ affected: 0 });

    await expect(service.deleteQuietHours(TENANT, SUBSCRIBER)).rejects.toThrow();
  });
});

describe("PreferencesService suppressions", () => {
  it("normalises the address before storing", async () => {
    const { service, suppressions } = build();

    await service.addSuppression(TENANT, { address: "  User@Example.COM ", reason: "unsubscribe" });

    expect(suppressions.create).toHaveBeenCalledWith(
      expect.objectContaining({ address: "user@example.com", channel: undefined }),
    );
  });

  it("updates the reason instead of duplicating an existing suppression", async () => {
    const { service, suppressions } = build();
    suppressions.findOne.mockResolvedValue({ id: "sup-1", reason: "bounce" });

    await service.addSuppression(TENANT, { address: "a@b.c", reason: "complaint" });

    expect(suppressions.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sup-1", reason: "complaint" }),
    );
    expect(suppressions.create).not.toHaveBeenCalled();
  });

  it("clamps the page size to at most 100", async () => {
    const { service, suppressions } = build();

    await service.listSuppressions(TENANT, { limit: 500, page: 2 });

    expect(suppressions.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 100 }),
    );
  });

  it("throws when removing a suppression the tenant does not own", async () => {
    const { service, suppressions } = build();
    suppressions.delete.mockResolvedValue({ affected: 0 });

    await expect(service.removeSuppression(TENANT, "missing")).rejects.toThrow();
  });
});

describe("PreferencesService.eraseSubscriberData", () => {
  it("erases subscriber-scoped stores and linked delivery events (tenant-scoped)", async () => {
    const ctx = build();
    ctx.preferences.delete.mockResolvedValue({ affected: 2 });
    ctx.suppressions.delete.mockResolvedValue({ affected: 1 });
    ctx.deviceRegistrations.delete.mockResolvedValue({ affected: 3 });
    ctx.topicSubQb.execute.mockResolvedValue({ affected: 4 });
    ctx.messageDeliveries.find.mockResolvedValue([{ id: "d1" }, { id: "d2" }]);
    ctx.deliveryEvents.delete.mockResolvedValue({ affected: 5 });
    ctx.messageDeliveries.delete.mockResolvedValue({ affected: 2 });

    const result = await ctx.service.eraseSubscriberData(TENANT, "  Sub-1  ");

    expect(ctx.topicSubQb.andWhere).toHaveBeenCalledWith(
      "topic_id IN (SELECT id FROM topics WHERE tenant_id = :tenantId)",
      { tenantId: TENANT },
    );
    expect(ctx.messageDeliveries.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT, recipient: "sub-1" },
      select: { id: true },
    });
    expect(ctx.deliveryEvents.delete).toHaveBeenCalled();
    expect(result).toEqual({
      preferences: 2,
      quietHours: 1,
      suppressions: 1,
      topicSubscriptions: 4,
      deviceRegistrations: 3,
      messageDeliveries: 2,
      deliveryEvents: 5,
      messagesRedacted: 0,
      notificationLogsRedacted: 0,
      deadLettersRedacted: 0,
    });
  });

  it("skips delivery-event delete when no deliveries match", async () => {
    const ctx = build();
    ctx.messageDeliveries.find.mockResolvedValue([]);

    const result = await ctx.service.eraseSubscriberData(TENANT, "nobody");

    expect(ctx.deliveryEvents.delete).not.toHaveBeenCalled();
    expect(result.deliveryEvents).toBe(0);
  });
});
