import dayjs from "dayjs";

/**
 * Timezone offset mapping (in minutes)
 * Covers major timezones worldwide
 */
const TIMEZONE_OFFSETS: Record<string, number> = {
  // UTC
  UTC: 0,
  GMT: 0,

  // Americas
  "America/New_York": -300, // EST/EDT
  "America/Chicago": -360,
  "America/Denver": -420,
  "America/Los_Angeles": -480,
  "America/Anchorage": -540,
  "Pacific/Honolulu": -600,
  "America/Toronto": -300,
  "America/Mexico_City": -360,
  "America/Buenos_Aires": -180,
  "America/Sao_Paulo": -180,

  // Europe
  "Europe/London": 0,
  "Europe/Paris": 60,
  "Europe/Berlin": 60,
  "Europe/Amsterdam": 60,
  "Europe/Brussels": 60,
  "Europe/Vienna": 60,
  "Europe/Prague": 60,
  "Europe/Warsaw": 60,
  "Europe/Moscow": 180,
  "Europe/Istanbul": 180,

  // Asia
  "Asia/Tokyo": 540,
  "Asia/Shanghai": 480,
  "Asia/Hong_Kong": 480,
  "Asia/Singapore": 480,
  "Asia/Bangkok": 420,
  "Asia/Dubai": 240,
  "Asia/Kolkata": 330,
  "Asia/Karachi": 300,
  "Asia/Jakarta": 420,
  "Asia/Manila": 480,
  "Asia/Seoul": 540,

  // Australia & Pacific
  "Australia/Sydney": 600,
  "Australia/Melbourne": 600,
  "Australia/Brisbane": 600,
  "Australia/Perth": 480,
  "Pacific/Auckland": 720,
  "Pacific/Fiji": 720,
  "Pacific/Tongatapu": 780,
};

/**
 * DateTime Helper - Lightweight timezone and scheduling utilities using dayjs
 */
export class DateTimeHelper {
  /**
   * Convert UTC time to subscriber's timezone
   */
  static convertToSubscriberTimezone(utcDate: Date, timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(utcDate.getTime() + offset * 60000);
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}, using UTC`);
      return utcDate;
    }
  }

  /**
   * Convert subscriber's local time to UTC
   */
  static convertToUTC(localDate: Date, timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(localDate.getTime() - offset * 60000);
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}, using UTC`);
      return localDate;
    }
  }

  /**
   * Get timezone offset in minutes
   */
  static getTimezoneOffset(timezone: string): number {
    return TIMEZONE_OFFSETS[timezone] ?? 0;
  }

  /**
   * Get current time in subscriber's timezone
   */
  static getCurrentTimeInTimezone(timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(new Date().getTime() + offset * 60000);
    } catch {
      return new Date();
    }
  }

  /**
   * Schedule notification for specific time in subscriber's timezone
   */
  static scheduleForTime(
    sendTime: string, // HH:mm format
    timezone: string,
    recurringDays?: number[], // 0-6 (Sunday-Saturday)
  ): Date {
    try {
      // Parse send time
      const [hours, minutes] = sendTime.split(":").map(Number);

      // Get current time in subscriber's timezone
      const offset = this.getTimezoneOffset(timezone);
      const now = new Date();
      const localNow = new Date(now.getTime() + offset * 60000);

      // Create next send time in local timezone
      let nextSend = new Date(localNow);
      nextSend.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (nextSend <= localNow) {
        nextSend.setDate(nextSend.getDate() + 1);
      }

      // If recurringDays specified, find next matching day
      if (recurringDays && recurringDays.length > 0) {
        while (!recurringDays.includes(nextSend.getDay())) {
          nextSend.setDate(nextSend.getDate() + 1);
        }
      }

      // Convert back to UTC for storage
      return new Date(nextSend.getTime() - offset * 60000);
    } catch (error) {
      console.warn(`Error scheduling for time: ${error}`);
      return new Date();
    }
  }

  /**
   * Get next occurrence of a recurring notification
   */
  static getNextRecurrence(
    currentDate: Date,
    frequency: "daily" | "weekly" | "monthly",
    endDate?: Date,
  ): Date | null {
    try {
      let next = new Date(currentDate);

      switch (frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
      }

      // Check if within end date
      if (endDate && next > endDate) {
        return null;
      }

      return next;
    } catch (error) {
      console.warn(`Error calculating recurrence: ${error}`);
      return null;
    }
  }

  /**
   * Check if notification is ready to send
   */
  static isReadyToSend(scheduledFor: Date): boolean {
    return dayjs(scheduledFor).isBefore(dayjs()) || dayjs(scheduledFor).isSame(dayjs());
  }

  /**
   * Get time until notification should be sent (in milliseconds)
   */
  static getTimeUntilSend(scheduledFor: Date): number {
    const now = dayjs();
    const scheduled = dayjs(scheduledFor);
    const diff = scheduled.diff(now);
    return Math.max(0, diff);
  }

  /**
   * Format date for display in subscriber's timezone
   */
  static formatInTimezone(
    date: Date,
    timezone: string,
    format: string = "YYYY-MM-DD HH:mm:ss",
  ): string {
    try {
      const offset = this.getTimezoneOffset(timezone);
      const localDate = new Date(date.getTime() + offset * 60000);
      return this.formatDate(localDate, format);
    } catch (error) {
      console.warn(`Error formatting date: ${error}`);
      return this.formatDate(date, format);
    }
  }

  /**
   * Format date using simple formatting
   */
  private static formatDate(date: Date, format: string): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  }

  /**
   * Parse time string in subscriber's timezone
   */
  static parseTimeInTimezone(
    timeString: string, // HH:mm format
    timezone: string,
  ): Date {
    try {
      const [hours, minutes] = timeString.split(":").map(Number);
      const offset = this.getTimezoneOffset(timezone);
      const now = new Date();
      const localNow = new Date(now.getTime() + offset * 60000);

      const parsed = new Date(localNow);
      parsed.setHours(hours, minutes, 0, 0);

      return new Date(parsed.getTime() - offset * 60000);
    } catch (error) {
      console.warn(`Error parsing time: ${error}`);
      return new Date();
    }
  }

  /**
   * Validate timezone
   */
  static isValidTimezone(timezone: string): boolean {
    return timezone in TIMEZONE_OFFSETS;
  }

  /**
   * Get all valid timezones
   */
  static getValidTimezones(): string[] {
    return Object.keys(TIMEZONE_OFFSETS);
  }

  /**
   * Add time to a date
   */
  static addTime(
    date: Date,
    amount: number,
    unit: "millisecond" | "second" | "minute" | "hour" | "day" | "week" | "month" | "year",
  ): Date {
    const result = new Date(date);
    switch (unit) {
      case "millisecond":
        result.setMilliseconds(result.getMilliseconds() + amount);
        break;
      case "second":
        result.setSeconds(result.getSeconds() + amount);
        break;
      case "minute":
        result.setMinutes(result.getMinutes() + amount);
        break;
      case "hour":
        result.setHours(result.getHours() + amount);
        break;
      case "day":
        result.setDate(result.getDate() + amount);
        break;
      case "week":
        result.setDate(result.getDate() + amount * 7);
        break;
      case "month":
        result.setMonth(result.getMonth() + amount);
        break;
      case "year":
        result.setFullYear(result.getFullYear() + amount);
        break;
    }
    return result;
  }

  /**
   * Subtract time from a date
   */
  static subtractTime(
    date: Date,
    amount: number,
    unit: "millisecond" | "second" | "minute" | "hour" | "day" | "week" | "month" | "year",
  ): Date {
    return this.addTime(date, -amount, unit);
  }

  /**
   * Get start of day in UTC
   */
  static getStartOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day in UTC
   */
  static getEndOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of week in UTC (Sunday)
   */
  static getStartOfWeek(date: Date = new Date()): Date {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = result.getUTCDate() - day;
    result.setUTCDate(diff);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of week in UTC (Saturday)
   */
  static getEndOfWeek(date: Date = new Date()): Date {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = result.getUTCDate() - day + 6;
    result.setUTCDate(diff);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of month in UTC
   */
  static getStartOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCDate(1);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of month in UTC
   */
  static getEndOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + 1);
    result.setUTCDate(0);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Check if date is in the past
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is in the future
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Check if two dates are on the same day
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate()
    );
  }

  /**
   * Get difference between two dates in specified unit
   */
  static getDifference(
    date1: Date,
    date2: Date,
    unit:
      | "millisecond"
      | "second"
      | "minute"
      | "hour"
      | "day"
      | "week"
      | "month"
      | "year" = "millisecond",
  ): number {
    const diffMs = date1.getTime() - date2.getTime();
    switch (unit) {
      case "millisecond":
        return diffMs;
      case "second":
        return Math.floor(diffMs / 1000);
      case "minute":
        return Math.floor(diffMs / (1000 * 60));
      case "hour":
        return Math.floor(diffMs / (1000 * 60 * 60));
      case "day":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case "week":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      case "month":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
      case "year":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
      default:
        return diffMs;
    }
  }
}
