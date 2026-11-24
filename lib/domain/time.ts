/**
 * The shop runs on Tashkent time (UTC+5). Dates are plain `YYYY-MM-DD` strings
 * and times are minutes from midnight, so nothing depends on the server's
 * locale or timezone.
 */
export const SHOP_TZ = "Asia/Tashkent";

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Current shop date and minute-of-day. */
export function shopClock(now: Date = new Date()): {
  date: string;
  minutes: number;
} {
  const parts = clock.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function today(): string {
  return shopClock().date;
}

export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function addDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function label(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when the interval already ended in shop time. */
export function isPast(date: string, end: number): boolean {
  const now = shopClock();
  if (date < now.date) return true;
  if (date > now.date) return false;
  return end <= now.minutes;
}

/** The next `count` bookable dates, starting today. */
export function nextDates(count: number): string[] {
  const start = today();
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatMonth(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} UZS`;
}
