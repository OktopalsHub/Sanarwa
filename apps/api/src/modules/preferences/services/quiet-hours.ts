const MINUTES_PER_DAY = 1440;

export function localMinuteOfDay(timeZone: string, now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return (hour % 24) * 60 + minute;
}

export function isInQuietHours(
  startMinute: number,
  endMinute: number,
  minuteOfDay: number,
): boolean {
  if (startMinute === endMinute) {
    return false;
  }

  if (startMinute < endMinute) {
    return minuteOfDay >= startMinute && minuteOfDay < endMinute;
  }

  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

export function minutesUntilQuietEnds(
  startMinute: number,
  endMinute: number,
  minuteOfDay: number,
): number {
  if (!isInQuietHours(startMinute, endMinute, minuteOfDay)) {
    return 0;
  }

  return (endMinute - minuteOfDay + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
