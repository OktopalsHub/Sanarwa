import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { DateTimeHelper } from "../../../common/utils/datetime.helper";

export interface ScheduleConfig {
  timezone: string;
  sendTime?: string;
  recurringDays?: number[];
  optimalSendTime?: boolean;
}

export interface ScheduledNotification {
  id: string;
  subscriberId: string;
  tenantId: string;
  channel: string;
  scheduledFor: Date;
  timezone: string;
  data: any;
  metadata?: Record<string, any>;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    endDate?: Date;
  };
}

const REGISTRY_KEY = "scheduled:keys";
const ITEM_TTL = 60 * 60 * 24 * 30;
const itemKey = (key: string) => `scheduled:item:${key}`;

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  convertToSubscriberTimezone(utcDate: Date, timezone: string): Date {
    return DateTimeHelper.convertToSubscriberTimezone(utcDate, timezone);
  }

  convertToUTC(localDate: Date, timezone: string): Date {
    return DateTimeHelper.convertToUTC(localDate, timezone);
  }

  async scheduleNotification(
    notification: ScheduledNotification,
    config: ScheduleConfig,
  ): Promise<ScheduledNotification> {
    const { timezone, sendTime, recurringDays } = config;

    if (!sendTime) {
      throw new Error("sendTime is required for scheduling");
    }

    const scheduledForUTC = DateTimeHelper.scheduleForTime(sendTime, timezone, recurringDays);

    const scheduled: ScheduledNotification = {
      ...notification,
      scheduledFor: scheduledForUTC,
      timezone,
    };

    const key = `${notification.tenantId}:${notification.subscriberId}:${notification.id}`;
    await this.redis.set(
      itemKey(key),
      JSON.stringify({
        ...scheduled,
        scheduledFor: scheduledForUTC.toISOString(),
        recurring: scheduled.recurring
          ? {
              ...scheduled.recurring,
              endDate: scheduled.recurring.endDate?.toISOString(),
            }
          : undefined,
      }),
      "EX",
      ITEM_TTL,
    );
    await this.redis.sadd(REGISTRY_KEY, key);

    const localTime = DateTimeHelper.convertToSubscriberTimezone(scheduledForUTC, timezone);

    this.logger.log(
      `Scheduled notification for ${notification.subscriberId} at ${DateTimeHelper.formatInTimezone(localTime, timezone)}`,
    );

    return scheduled;
  }

  calculateOptimalSendTime(
    timezone: string,
    engagementData?: { openRate: number; clickRate: number; time: string }[],
  ): string {
    if (!engagementData || engagementData.length === 0) {
      return "09:00";
    }

    const bestTime = engagementData.reduce((best, current) =>
      current.openRate + current.clickRate > best.openRate + best.clickRate ? current : best,
    );

    return bestTime.time;
  }

  getNextSendTime(notification: ScheduledNotification): Date {
    if (DateTimeHelper.isFuture(notification.scheduledFor)) {
      return notification.scheduledFor;
    }

    if (notification.recurring) {
      const next = DateTimeHelper.getNextRecurrence(
        notification.scheduledFor,
        notification.recurring.frequency,
        notification.recurring.endDate,
      );

      return next as any;
    }

    return null as any;
  }

  async getReadyNotifications(): Promise<ScheduledNotification[]> {
    const ready: ScheduledNotification[] = [];

    for (const notification of await this.readAll()) {
      if (DateTimeHelper.isReadyToSend(notification.scheduledFor)) {
        ready.push(notification);
      }
    }

    return ready;
  }

  async markAsSent(notificationId: string): Promise<void> {
    const keys = await this.redis.smembers(REGISTRY_KEY);
    const key = keys.find((candidate) => candidate.endsWith(notificationId));

    if (!key) {
      return;
    }

    const notification = await this.readItem(key);

    if (notification?.recurring) {
      const nextSend = this.getNextSendTime(notification);
      if (nextSend) {
        notification.scheduledFor = nextSend;
        await this.writeItem(key, notification);
        this.logger.log(`Rescheduled recurring notification for ${notification.subscriberId}`);
        return;
      }

      this.logger.log(`Recurring notification ended for ${notification.subscriberId}`);
    }

    await this.redis.del(itemKey(key));
    await this.redis.srem(REGISTRY_KEY, key);
  }

  async getPendingNotifications(
    subscriberId: string,
    tenantId: string,
  ): Promise<ScheduledNotification[]> {
    const pending: ScheduledNotification[] = [];

    for (const notification of await this.readAll()) {
      if (notification.subscriberId === subscriberId && notification.tenantId === tenantId) {
        pending.push(notification);
      }
    }

    return pending;
  }

  async cancelNotification(notificationId: string): Promise<void> {
    const keys = await this.redis.smembers(REGISTRY_KEY);
    const key = keys.find((candidate) => candidate.endsWith(notificationId));

    if (key) {
      await this.redis.del(itemKey(key));
      await this.redis.srem(REGISTRY_KEY, key);
      this.logger.log(`Cancelled scheduled notification: ${notificationId}`);
    }
  }

  async getSchedulingStats(): Promise<{
    totalScheduled: number;
    readyToSend: number;
    byTimezone: Record<string, number>;
  }> {
    const notifications = await this.readAll();
    const ready = await this.getReadyNotifications();
    const byTimezone: Record<string, number> = {};

    for (const notification of notifications) {
      byTimezone[notification.timezone] = (byTimezone[notification.timezone] || 0) + 1;
    }

    return {
      totalScheduled: notifications.length,
      readyToSend: ready.length,
      byTimezone,
    };
  }

  isValidTimezone(timezone: string): boolean {
    return DateTimeHelper.isValidTimezone(timezone);
  }

  getValidTimezones(): string[] {
    return DateTimeHelper.getValidTimezones();
  }

  getCurrentTimeInTimezone(timezone: string): Date {
    return DateTimeHelper.getCurrentTimeInTimezone(timezone);
  }

  private async readAll(): Promise<ScheduledNotification[]> {
    const keys = await this.redis.smembers(REGISTRY_KEY);
    if (keys.length === 0) {
      return [];
    }

    const raws = await this.redis.mget(keys.map((key) => itemKey(key)));
    const notifications: ScheduledNotification[] = [];

    for (const raw of raws) {
      if (!raw) {
        continue;
      }

      notifications.push(this.revive(JSON.parse(raw)));
    }

    return notifications;
  }

  private async readItem(key: string): Promise<ScheduledNotification | null> {
    const raw = await this.redis.get(itemKey(key));
    return raw ? this.revive(JSON.parse(raw)) : null;
  }

  private async writeItem(key: string, notification: ScheduledNotification): Promise<void> {
    await this.redis.set(
      itemKey(key),
      JSON.stringify({
        ...notification,
        scheduledFor: notification.scheduledFor.toISOString(),
        recurring: notification.recurring
          ? {
              ...notification.recurring,
              endDate: notification.recurring.endDate?.toISOString(),
            }
          : undefined,
      }),
      "EX",
      ITEM_TTL,
    );
  }

  private revive(stored: any): ScheduledNotification {
    return {
      ...stored,
      scheduledFor: new Date(stored.scheduledFor),
      recurring: stored.recurring
        ? {
            ...stored.recurring,
            endDate: stored.recurring.endDate ? new Date(stored.recurring.endDate) : undefined,
          }
        : undefined,
    };
  }
}
