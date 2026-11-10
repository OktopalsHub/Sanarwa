import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { MessagePriority } from "../messaging/message.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { NotificationSuppression } from "./entities/notification-suppression.entity";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { SubscriberQuietHours } from "./entities/subscriber-quiet-hours.entity";
import { isInQuietHours, localMinuteOfDay, minutesUntilQuietEnds } from "./services/quiet-hours";

export type ConsentCheckInput = {
  tenantId: string;
  address: string;
  subscriberId?: string;
  channel: NotificationChannel;
  priority?: MessagePriority | string;
  now?: Date;
};

export type ConsentVerdict =
  | { allowed: true }
  | { allowed: false; reason: "suppressed" | "preference" }
  | { allowed: false; reason: "quiet_hours"; deferred: true; delayMs: number; resumeAt: Date };

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(NotificationSuppression)
    private readonly suppressions: Repository<NotificationSuppression>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(SubscriberQuietHours)
    private readonly quietHours: Repository<SubscriberQuietHours>,
  ) {}

  async checkConsent(input: ConsentCheckInput): Promise<ConsentVerdict> {
    const now = input.now ?? new Date();
    const address = input.address.trim().toLowerCase();

    const suppressed = await this.suppressions.findOne({
      where: [
        { tenantId: input.tenantId, address, channel: input.channel },
        { tenantId: input.tenantId, address, channel: IsNull() },
      ],
    });

    if (suppressed) {
      return { allowed: false, reason: "suppressed" };
    }

    const subscriberId = input.subscriberId?.trim() ? input.subscriberId.trim() : address;

    const preference = await this.preferences.findOne({
      where: { tenantId: input.tenantId, subscriberId, channel: input.channel },
    });

    if (preference && !preference.enabled) {
      return { allowed: false, reason: "preference" };
    }

    const quietHours = await this.quietHours.findOne({
      where: { tenantId: input.tenantId, subscriberId, enabled: true },
    });

    if (quietHours) {
      const minuteOfDay = localMinuteOfDay(quietHours.timezone, now);

      if (isInQuietHours(quietHours.startMinute, quietHours.endMinute, minuteOfDay)) {
        const isUrgent =
          typeof input.priority === "string" && input.priority.toLowerCase() === "urgent";

        if (!isUrgent) {
          const minutesUntilEnd = minutesUntilQuietEnds(
            quietHours.startMinute,
            quietHours.endMinute,
            minuteOfDay,
          );

          if (minutesUntilEnd > 0) {
            const delayMs = minutesUntilEnd * 60_000;

            return {
              allowed: false,
              reason: "quiet_hours",
              deferred: true,
              delayMs,
              resumeAt: new Date(now.getTime() + delayMs),
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  async suppress(
    tenantId: string,
    address: string,
    reason: string,
    channel?: NotificationChannel,
  ): Promise<void> {
    const normalized = address.trim().toLowerCase();
    const where = channel
      ? { tenantId, address: normalized, channel }
      : { tenantId, address: normalized, channel: IsNull() };

    const existing = await this.suppressions.findOne({ where });
    if (existing) return;

    try {
      await this.suppressions.save(
        this.suppressions.create({
          tenantId,
          address: normalized,
          channel,
          reason,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  async unsuppress(
    tenantId: string,
    address: string,
    channel?: NotificationChannel,
  ): Promise<void> {
    const normalized = address.trim().toLowerCase();

    await this.suppressions.delete({
      tenantId,
      address: normalized,
      ...(channel ? { channel } : { channel: IsNull() }),
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; driverError?: { code?: string } };
  return e.code === "23505" || e.driverError?.code === "23505";
}
