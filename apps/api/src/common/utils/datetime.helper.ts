import dayjs from "dayjs";

const TIMEZONE_OFFSETS: Record<string, number> = {
  UTC: 0,
  GMT: 0,

  "America/New_York": -300,
  "America/Chicago": -360,
  "America/Denver": -420,
  "America/Los_Angeles": -480,
  "America/Anchorage": -540,
  "Pacific/Honolulu": -600,
  "America/Toronto": -300,
  "America/Mexico_City": -360,
  "America/Buenos_Aires": -180,
  "America/Sao_Paulo": -180,

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

  "Australia/Sydney": 600,
  "Australia/Melbourne": 600,
  "Australia/Brisbane": 600,
  "Australia/Perth": 480,
  "Pacific/Auckland": 720,
  "Pacific/Fiji": 720,
  "Pacific/Tongatapu": 780,
};

export class DateTimeHelper {
  static convertToSubscriberTimezone(utcDate: Date, timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(utcDate.getTime() + offset * 60000);
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}, using UTC`);
      return utcDate;
    }
  }

  static convertToUTC(localDate: Date, timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(localDate.getTime() - offset * 60000);
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}, using UTC`);
      return localDate;
    }
  }

  static getTimezoneOffset(timezone: string): number {
    return TIMEZONE_OFFSETS[timezone] ?? 0;
  }

  static getCurrentTimeInTimezone(timezone: string): Date {
    try {
      const offset = this.getTimezoneOffset(timezone);
      return new Date(new Date().getTime() + offset * 60000);
    } catch {
      return new Date();
    }
  }

  static scheduleForTime(sendTime: string, timezone: string, recurringDays?: number[]): Date {
    try {
      const [hours, minutes] = sendTime.split(":").map(Number);

      const offset = this.getTimezoneOffset(timezone);
      const now = new Date();
      const localNow = new Date(now.getTime() + offset * 60000);

      let nextSend = new Date(localNow);
      nextSend.setHours(hours, minutes, 0, 0);

      if (nextSend <= localNow) {
        nextSend.setDate(nextSend.getDate() + 1);
      }

      if (recurringDays && recurringDays.length > 0) {
        while (!recurringDays.includes(nextSend.getDay())) {
          nextSend.setDate(nextSend.getDate() + 1);
        }
      }

      return new Date(nextSend.getTime() - offset * 60000);
    } catch (error) {
      console.warn(`Error scheduling for time: ${error}`);
      return new Date();
    }
  }

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

      if (endDate && next > endDate) {
        return null;
      }

      return next;
    } catch (error) {
      console.warn(`Error calculating recurrence: ${error}`);
      return null;
    }
  }

  static isReadyToSend(scheduledFor: Date): boolean {
    return dayjs(scheduledFor).isBefore(dayjs()) || dayjs(scheduledFor).isSame(dayjs());
  }

  static getTimeUntilSend(scheduledFor: Date): number {
    const now = dayjs();
    const scheduled = dayjs(scheduledFor);
    const diff = scheduled.diff(now);
    return Math.max(0, diff);
  }

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

  static parseTimeInTimezone(timeString: string, timezone: string): Date {
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

  static isValidTimezone(timezone: string): boolean {
    return timezone in TIMEZONE_OFFSETS;
  }

  static getValidTimezones(): string[] {
    return Object.keys(TIMEZONE_OFFSETS);
  }

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

  static subtractTime(
    date: Date,
    amount: number,
    unit: "millisecond" | "second" | "minute" | "hour" | "day" | "week" | "month" | "year",
  ): Date {
    return this.addTime(date, -amount, unit);
  }

  static getStartOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  static getEndOfDay(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  static getStartOfWeek(date: Date = new Date()): Date {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = result.getUTCDate() - day;
    result.setUTCDate(diff);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  static getEndOfWeek(date: Date = new Date()): Date {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = result.getUTCDate() - day + 6;
    result.setUTCDate(diff);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  static getStartOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCDate(1);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  static getEndOfMonth(date: Date = new Date()): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + 1);
    result.setUTCDate(0);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  static isPast(date: Date): boolean {
    return date < new Date();
  }

  static isFuture(date: Date): boolean {
    return date > new Date();
  }

  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate()
    );
  }

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
