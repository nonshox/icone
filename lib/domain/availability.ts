import "server-only";

import { getBarber, getDay, listBusy, listHours, type Window } from "./data";
import { addDays, label, shopClock, today, weekday } from "./time";
import type { Slot } from "./types";

/** Bookings are offered on a fixed grid. */
export const SLOT_STEP = 15;
/** Nobody can book a slot that starts sooner than this. */
export const LEAD_MINUTES = 30;
/** How far ahead the calendar opens. */
export const HORIZON_DAYS = 60;

export function isBookableDate(date: string): boolean {
  const start = today();
  return date >= start && date <= addDays(start, HORIZON_DAYS);
}

/** Opening windows for a barber on a date, already clipped to now + lead. */
export async function getWindows(
  barberId: string,
  date: string,
): Promise<Window[]> {
  if (!isBookableDate(date)) return [];

  const override = await getDay(barberId, date);
  let windows: Window[];

  if (override) {
    windows = override.open ? [{ start: override.start, end: override.end }] : [];
  } else {
    const hours = await listHours(barberId);
    const day = weekday(date);
    windows = hours
      .filter((row) => row.day === day)
      .map((row) => ({ start: row.start, end: row.end }));
  }

  const clock = shopClock();
  if (date === clock.date) {
    const floor = clock.minutes + LEAD_MINUTES;
    windows = windows
      .map((window) => ({ start: Math.max(window.start, floor), end: window.end }))
      .filter((window) => window.end > window.start);
  }

  return windows;
}

function overlaps(
  start: number,
  end: number,
  busy: Array<{ start: number; end: number }>,
): boolean {
  return busy.some((row) => start < row.end && row.start < end);
}

/**
 * Free start times for a barber, date and service duration.
 * Returns whole slots only: the service must fit inside the opening window.
 */
export async function getSlots(input: {
  barber: string;
  date: string;
  time: number;
}): Promise<Slot[]> {
  const barber = await getBarber(input.barber);
  if (!barber || !barber.active) return [];

  const windows = await getWindows(input.barber, input.date);
  if (windows.length === 0) return [];

  const busy = (await listBusy(input.barber, input.date)).map((booking) => ({
    start: booking.start,
    end: booking.end,
  }));

  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (const window of windows) {
    const first = Math.ceil(window.start / SLOT_STEP) * SLOT_STEP;

    for (let start = first; start + input.time <= window.end; start += SLOT_STEP) {
      if (seen.has(start)) continue;
      if (overlaps(start, start + input.time, busy)) continue;

      seen.add(start);
      slots.push({
        start,
        end: start + input.time,
        label: label(start),
      });
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

/** Whether a specific interval is free and inside opening hours. */
export async function isFree(input: {
  barber: string;
  date: string;
  start: number;
  end: number;
}): Promise<boolean> {
  const windows = await getWindows(input.barber, input.date);
  const inside = windows.some(
    (window) => input.start >= window.start && input.end <= window.end,
  );
  if (!inside) return false;

  const busy = await listBusy(input.barber, input.date);
  return !overlaps(
    input.start,
    input.end,
    busy.map((booking) => ({ start: booking.start, end: booking.end })),
  );
}
