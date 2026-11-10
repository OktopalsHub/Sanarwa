import { describe, expect, it, vi, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Mock } from "vitest";
import { IsNull } from "typeorm";
import { ConsentService } from "../consent.service";
import { isInQuietHours, localMinuteOfDay, minutesUntilQuietEnds } from "../services/quiet-hours";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { NotificationSuppression } from "../entities/notification-suppression.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";
import { SubscriberQuietHours } from "../entities/subscriber-quiet-hours.entity";

const TENANT = "tenant-1";
const ADDRESS = "user@Example.com";
const NORMALIZED = "user@example.com";
const FIXED_NOW = new Date("2026-11-09T22:30:00.000Z");

function makeRepo() {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockImplementation((value) => value),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
}

describe("quiet-hours math", () => {
  it("reports the local minute of day for a timezone", () => {
    expect(localMinuteOfDay("UTC", FIXED_NOW)).toBe(22 * 60 + 30);
  });

  it("applies a positive UTC offset", () => {
    expect(localMinuteOfDay("Asia/Kolkata", FIXED_NOW)).toBe(4 * 60 + 0);
  });

  it("applies a negative UTC offset", () => {
    expect(localMinuteOfDay("America/New_York", FIXED_NOW)).toBe(17 * 60 + 30);
  });

  it("handles the midnight hour", () => {
    expect(localMinuteOfDay("UTC", new Date("2026-11-09T00:30:00.000Z"))).toBe(30);
  });

  it("detects times inside and outside a same-day window", () => {
    expect(isInQuietHours(60, 240, 120)).toBe(true);
    expect(isInQuietHours(60, 240, 300)).toBe(false);
  });

  it("detects times inside and outside a midnight-wrapping window", () => {
    expect(isInQuietHours(1320, 420, 1380)).toBe(true);
    expect(isInQuietHours(1320, 420, 100)).toBe(true);
    expect(isInQuietHours(1320, 420, 500)).toBe(false);
  });

  it("computes minutes until the window closes, wrapping midnight", () => {
    expect(minutesUntilQuietEnds(1320, 420, 1380)).toBe(480);
    expect(minutesUntilQuietEnds(1320, 420, 120)).toBe(300);
    expect(minutesUntilQuietEnds(1320, 420, 500)).toBe(0);
  });

  it("never deferrs for a disabled (zero-width) window", () => {
    expect(isInQuietHours(600, 600, 600)).toBe(false);
    expect(minutesUntilQuietEnds(600, 600, 600)).toBe(0);
  });
});

describe("ConsentService", () => {
  let service: ConsentService;
  let suppressions: ReturnType<typeof makeRepo>;
  let preferences: ReturnType<typeof makeRepo>;
  let quietHours: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    suppressions = makeRepo();
    preferences = makeRepo();
    quietHours = makeRepo();

    const module = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: getRepositoryToken(NotificationSuppression), useValue: suppressions },
        { provide: getRepositoryToken(NotificationPreference), useValue: preferences },
        { provide: getRepositoryToken(SubscriberQuietHours), useValue: quietHours },
      ],
    }).compile();

    service = module.get(ConsentService);
  });

  it("blocks a suppressed address with an all-channels suppression", async () => {
    suppressions.findOne.mockResolvedValueOnce({
      id: "s-1",
      tenantId: TENANT,
      address: NORMALIZED,
      channel: null,
      reason: "manual",
    });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: false, reason: "suppressed" });
  });

  it("blocks when a channel-specific suppression matches", async () => {
    suppressions.findOne.mockResolvedValueOnce({ id: "s-1" });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.SMS,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: false, reason: "suppressed" });
    expect(suppressions.findOne).toHaveBeenCalledWith({
      where: [
        { tenantId: TENANT, address: NORMALIZED, channel: NotificationChannel.SMS },
        { tenantId: TENANT, address: NORMALIZED, channel: IsNull() },
      ],
    });
  });

  it("allows a suppressed address on a different channel", async () => {
    suppressions.findOne.mockResolvedValueOnce(null);

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.PUSH,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: true });
  });

  it("allows delivery when no consent rows exist", async () => {
    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: true });
  });

  it("blocks an opted-out subscriber with reason preference", async () => {
    preferences.findOne.mockResolvedValueOnce({ subscriberId: NORMALIZED, enabled: false });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: false, reason: "preference" });
  });

  it("prefers the preference reason over quiet hours", async () => {
    preferences.findOne.mockResolvedValueOnce({ subscriberId: NORMALIZED, enabled: false });
    quietHours.findOne.mockResolvedValueOnce({
      enabled: true,
      timezone: "UTC",
      startMinute: 1320,
      endMinute: 420,
    });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: false, reason: "preference" });
  });

  it("defers delivery during quiet hours with a delay until the window closes", async () => {
    quietHours.findOne.mockResolvedValueOnce({
      enabled: true,
      timezone: "UTC",
      startMinute: 1320,
      endMinute: 420,
    });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict.allowed).toBe(false);

    if (!verdict.allowed && verdict.reason === "quiet_hours") {
      expect(verdict.delayMs).toBe(8.5 * 60 * 60 * 1000);
      expect(verdict.resumeAt.getTime()).toBe(FIXED_NOW.getTime() + verdict.delayMs);
    } else {
      throw new Error(`expected quiet_hours deferral, got ${JSON.stringify(verdict)}`);
    }
  });

  it("lets urgent priority bypass quiet hours", async () => {
    quietHours.findOne.mockResolvedValueOnce({
      enabled: true,
      timezone: "UTC",
      startMinute: 1320,
      endMinute: 420,
    });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      priority: "urgent",
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: true });
  });

  it("does not defer when the quiet-hours row is disabled", async () => {
    quietHours.findOne.mockResolvedValueOnce({ enabled: false });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: true });
  });

  it("defers against the subscriber timezone, not the server zone", async () => {
    quietHours.findOne.mockResolvedValueOnce({
      enabled: true,
      timezone: "America/New_York",
      startMinute: 1320,
      endMinute: 420,
    });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.EMAIL,
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: true });
  });

  it("checks the preference for the subscriber id, falling back to the address", async () => {
    const subscriberId = "user-42";

    await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      subscriberId,
      channel: NotificationChannel.SMS,
      now: FIXED_NOW,
    });

    expect(preferences.findOne).toHaveBeenCalledWith({
      where: { tenantId: TENANT, subscriberId, channel: NotificationChannel.SMS },
    });
  });

  it("suppresses even at urgent priority; suppression is a hard stop", async () => {
    suppressions.findOne.mockResolvedValueOnce({ id: "s-1" });

    const verdict = await service.checkConsent({
      tenantId: TENANT,
      address: ADDRESS,
      channel: NotificationChannel.PUSH,
      priority: "urgent",
      now: FIXED_NOW,
    });

    expect(verdict).toEqual({ allowed: false, reason: "suppressed" });
  });

  it("stores suppressions normalized and reads them back normalized", async () => {
    await service.suppress(TENANT, "  USER@Example.com ", "manual");

    expect(suppressions.create).toHaveBeenCalledWith(
      expect.objectContaining({ address: NORMALIZED }),
    );
  });
});
