import { Injectable, Logger } from "@nestjs/common";
import { DateTimeHelper } from "../../../common/utils/datetime.helper";

export interface ScheduleConfig {
  timezone: string;
  sendTime?: string; // HH:mm format
  recurringDays?: number[]; // 0-6 (Sunday-Saturday)
  optimalSendTime?: boolean;
}

export interface ScheduledNotification {
  id: string;
  subscriberId: string;
  tenantId: string;
  channel: string;
  scheduledFor: Date;
  timezone: string;
  content: any;
  metadata?: Record<string, any>;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    endDate?: Date;
  };
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  /**
   * Convert UTC time to subscriber's timezone
   */
  convertToSubscriberTimezone(utcDate: Date, timezone: string): Date {
    return DateTimeHelper.convertToSubscriberTimezone(utcDate, timezone);
  }

  /**
   * Convert subscriber's local time to UTC
   */
  convertToUTC(localDate: Date, timezone: string): Date {
    return DateTimeHelper.convertToUTC(localDate, timezone);
  }

  /**
   * Schedule notification for specific time in subscriber's timezone
   */
  async scheduleNotification(
    notification: ScheduledNotification,
    config: ScheduleConfig,
  ): Promise<ScheduledNotification> {
    const { timezone, sendTime, recurringDays } = config;

    if (!sendTime) {
      throw new Error("sendTime is required for scheduling");
    }

    // Schedule for the specified time using helper
    const scheduledForUTC = DateTimeHelper.scheduleForTime(sendTime, timezone, recurringDays);

    const scheduled: ScheduledNotification = {
      ...notification,
      scheduledFor: scheduledForUTC,
      timezone,
    };

    const key = `${notification.tenantId}:${notification.subscriberId}:${notification.id}`;
    this.scheduledNotifications.set(key, scheduled);

    const localTime = DateTimeHelper.convertToSubscriberTimezone(scheduledForUTC, timezone);

    this.logger.log(
      `Scheduled notification for ${notification.subscriberId} at ${DateTimeHelper.formatInTimezone(localTime, timezone)}`,
    );

    return scheduled;
  }

  /**
   * Calculate optimal send time based on engagement patterns
   * (simplified - in production, use ML/analytics data)
   */
  calculateOptimalSendTime(
    timezone: string,
    engagementData?: { openRate: number; clickRate: number; time: string }[],
  ): string {
    if (!engagementData || engagementData.length === 0) {
      // Default optimal time: 9 AM
      return "09:00";
    }

    // Find time with highest engagement
    const bestTime = engagementData.reduce((best, current) =>
      current.openRate + current.clickRate > best.openRate + best.clickRate ? current : best,
    );

    return bestTime.time;
  }

  /**
   * Get next send time for a notification
   */
  getNextSendTime(notification: ScheduledNotification): Date {
    if (DateTimeHelper.isFuture(notification.scheduledFor)) {
      return notification.scheduledFor;
    }

    // If recurring, calculate next occurrence
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

  /**
   * Get notifications ready to send
   */
  getReadyNotifications(): ScheduledNotification[] {
    const ready: ScheduledNotification[] = [];

    for (const notification of this.scheduledNotifications.values()) {
      if (DateTimeHelper.isReadyToSend(notification.scheduledFor)) {
        ready.push(notification);
      }
    }

    return ready;
  }

  /**
   * Mark notification as sent and handle recurring
   */
  async markAsSent(notificationId: string): Promise<void> {
    const key = Array.from(this.scheduledNotifications.keys()).find((k) =>
      k.endsWith(notificationId),
    );

    if (!key) {
      return;
    }

    const notification = this.scheduledNotifications.get(key)!;

    if (notification.recurring) {
      // Reschedule for next occurrence
      const nextSend = this.getNextSendTime(notification);
      if (nextSend) {
        notification.scheduledFor = nextSend;
        this.logger.log(`Rescheduled recurring notification for ${notification.subscriberId}`);
      } else {
        // End of recurrence
        this.scheduledNotifications.delete(key);
        this.logger.log(`Recurring notification ended for ${notification.subscriberId}`);
      }
    } else {
      // Remove one-time notification
      this.scheduledNotifications.delete(key);
    }
  }

  /**
   * Get pending notifications for a subscriber
   */
  getPendingNotifications(subscriberId: string, tenantId: string): ScheduledNotification[] {
    const pending: ScheduledNotification[] = [];

    for (const notification of this.scheduledNotifications.values()) {
      if (notification.subscriberId === subscriberId && notification.tenantId === tenantId) {
        pending.push(notification);
      }
    }

    return pending;
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    const key = Array.from(this.scheduledNotifications.keys()).find((k) =>
      k.endsWith(notificationId),
    );

    if (key) {
      this.scheduledNotifications.delete(key);
      this.logger.log(`Cancelled scheduled notification: ${notificationId}`);
    }
  }

  /**
   * Get scheduling statistics
   */
  getSchedulingStats(): {
    totalScheduled: number;
    readyToSend: number;
    byTimezone: Record<string, number>;
  } {
    const ready = this.getReadyNotifications();
    const byTimezone: Record<string, number> = {};

    for (const notification of this.scheduledNotifications.values()) {
      byTimezone[notification.timezone] = (byTimezone[notification.timezone] || 0) + 1;
    }

    return {
      totalScheduled: this.scheduledNotifications.size,
      readyToSend: ready.length,
      byTimezone,
    };
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone: string): boolean {
    return DateTimeHelper.isValidTimezone(timezone);
  }

  /**
   * Get all valid timezones
   */
  getValidTimezones(): string[] {
    return DateTimeHelper.getValidTimezones();
  }

  /**
   * Get current time in subscriber's timezone
   */
  getCurrentTimeInTimezone(timezone: string): Date {
    return DateTimeHelper.getCurrentTimeInTimezone(timezone);
  }
}
