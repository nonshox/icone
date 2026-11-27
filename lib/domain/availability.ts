import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { list, num, str, type Row } from "./crud";
import { getBarber, isBookable, type BarberRow } from "./professional";
import { getBranch } from "./business";
import { getBreaks, getDay, getHours } from "./schedule";
import { addDays, label, shopClock, today, weekday } from "./time";
import type { BreakRow, Slot, Window } from "./types";

/** Bookings are offered on a fixed grid. */
export const DEFAULT_STEP = 15;
/** Nobody can book a slot that starts sooner than this. */
export const LEAD_MINUTES = 30;
/** How far ahead the calendar opens. */
export const HORIZON_DAYS = 60;

/** Statuses that hold a slot. Rejected and cancelled releases it. */
const HOLDING = ["pending", "confirmed", "done"];

export function isBookableDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const start = today();
  return date >= start && date <= addDays(start, HORIZON_DAYS);
}

/* ------------------------------------------------------------- set maths */

export function intersect(a: Window[], b: Window[]): Window[] {
  const out: Window[] = [];
  for (const left of a) {
    for (const right of b) {
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (end > start) out.push({ start, end });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Remove the break ranges from a set of working windows. */
export function subtract(windows: Window[], cuts: Window[]): Window[] {
  if (cuts.length === 0) return windows;

  const out: Window[] = [];
  for (const window of windows) {
    let pieces: Window[] = [window];
    for (const cut of cuts) {
      const next: Window[] = [];
      for (const piece of pieces) {
        if (cut.end <= piece.start || cut.start >= piece.end) {
          next.push(piece);
          continue;
        }
        if (cut.start > piece.start) next.push({ start: piece.start, end: cut.start });
        if (cut.end < piece.end) next.push({ start: cut.end, end: piece.end });
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out.sort((x, y) => x.start - y.start);
}

export function overlaps(
  start: number,
  end: number,
  busy: Array<{ start: number; end: number }>,
): boolean {
  return busy.some((row) => start < row.end && row.start < end);
}

/* ------------------------------------------------------------ working time */

async function baseWindows(owner: string, scope: "barber" | "branch", date: string): Promise<{
  windows: Window[];
  /** false when the owner has configured nothing at all for that scope. */
  configured: boolean;
}> {
  const override = await getDay(owner, date, scope);
  if (override) {
    return override.open && override.end > override.start
      ? { windows: [{ start: override.start, end: override.end }], configured: true }
      : { windows: [], configured: true };
  }

  const hours = await getHours(owner, scope);
  if (hours.length === 0) return { windows: [], configured: false };

  const day = weekday(date);
  return {
    windows: hours
      .filter((row) => row.day === day)
      .map((row) => ({ start: row.start, end: row.end })),
    configured: true,
  };
}

async function breaksFor(owner: string, scope: "barber" | "branch", date: string): Promise<Window[]> {
  const rows: BreakRow[] = await getBreaks(owner, scope);
  const day = weekday(date);
  return rows
    .filter((row) => row.day === day)
    .map((row) => ({ start: row.start, end: row.end }));
}

/**
 * When this professional can be seen on one date.
 *
 * A shop employee is only free when both their own hours and their branch's
 * hours are open; an independent barber is free when their own are. Breaks
 * from either side are cut out, and today's window is clipped to the lead
 * time so a slot can never start in the past.
 */
export async function getWindows(barber: BarberRow, date: string): Promise<Window[]> {
  if (!isBookable(barber)) return [];
  if (!isBookableDate(date)) return [];

  const own = await baseWindows(barber.id, "barber", date);
  let windows = own.windows;

  if (barber.branch) {
    const branchRow = await getBranch(barber.branch);
    if (branchRow && !branchRow.active) return [];
    const branch = await baseWindows(barber.branch, "branch", date);
    // A branch that has never set hours does not restrict its staff.
    if (branch.configured) windows = intersect(windows, branch.windows);
  }

  const ownBreaks = await breaksFor(barber.id, "barber", date);
  if (barber.branch) {
    ownBreaks.push(...(await breaksFor(barber.branch, "branch", date)));
  }
  windows = subtract(windows, ownBreaks);

  const clock = shopClock();
  if (date === clock.date) {
    const floor = clock.minutes + LEAD_MINUTES;
    windows = windows
      .map((window) => ({ start: Math.max(window.start, floor), end: window.end }))
      .filter((window) => window.end > window.start);
  }

  return windows;
}

/** Appointments that hold time on one professional's day. */
export async function busyFor(
  barberId: string,
  date: string,
): Promise<Array<{ id: string; start: number; end: number }>> {
  // A fully booked day can hold more than one page of rows; paging keeps
  // later slots from appearing free. `id` lets a reschedule ignore its own row.
  const rows: Row[] = [];
  const page = 200;
  for (let offset = 0; offset < 2000; offset += page) {
    const batch = await list(TABLES.bookings, [
      Query.equal("barber", barberId),
      Query.equal("date", date),
      Query.equal("status", HOLDING),
      Query.limit(page),
      Query.offset(offset),
    ]);
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows.map((row) => ({
    id: row.$id,
    start: num(row.start),
    end: num(row.end),
  }));
}

/* ------------------------------------------------------------------ slots */

export type SlotQuery = {
  barber: string;
  date: string;
  /** Total minutes the appointment occupies, buffer included. */
  time: number;
  /** Grid step; defaults to the professional's own setting. */
  step?: number;
};

/**
 * Free start times for one professional, date and duration.
 *
 * A slot only appears when the whole visit fits inside the working window
 * with nothing booked, on the professional's own grid.
 */
export async function getSlots(query: SlotQuery): Promise<Slot[]> {
  const barber = await getBarber(query.barber);
  if (!barber) return [];

  const windows = await getWindows(barber, query.date);
  if (windows.length === 0 || query.time <= 0) return [];

  const busy = await busyFor(barber.id, query.date);
  const step = query.step ?? barber.step ?? DEFAULT_STEP;
  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const window of windows) {
    const first = Math.ceil(window.start / step) * step;
    for (let start = first; start + query.time <= window.end; start += step) {
      if (seen.has(start)) continue;
      if (overlaps(start, start + query.time, busy)) continue;
      seen.add(start);
      slots.push({ start, end: start + query.time, label: label(start) });
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

/** Whether one interval is entirely free and inside working hours. */
export async function isFree(input: {
  barber: string;
  date: string;
  start: number;
  end: number;
}): Promise<boolean> {
  const barber = await getBarber(input.barber);
  if (!barber || !isBookable(barber)) return false;

  const windows = await getWindows(barber, input.date);
  const inside = windows.some(
    (window) => input.start >= window.start && input.end <= window.end,
  );
  if (!inside) return false;

  const busy = await busyFor(barber.id, input.date);
  return !overlaps(input.start, input.end, busy);
}

/**
 * First free slot on or after `from`, scanning ahead day by day.
 * Returns null when nothing opens inside the horizon.
 */
export async function nextFree(input: {
  barber: string;
  time: number;
  from?: string;
  days?: number;
}): Promise<{ date: string; start: number; end: number } | null> {
  const clock = shopClock();
  const from = input.from && input.from >= clock.date ? input.from : clock.date;
  const span = Math.min(HORIZON_DAYS, Math.max(1, input.days ?? 14));

  for (let offset = 0; offset < span; offset += 1) {
    const date = addDays(from, offset);
    const slots = await getSlots({ barber: input.barber, date, time: input.time });
    if (slots.length > 0) {
      return { date, start: slots[0].start, end: slots[0].end };
    }
  }
  return null;
}

/* ---------------------------------------------------- "any available" */

export type Candidate = {
  barber: string;
  date: string;
  start: number;
};

/**
 * Earliest slot across every professional who can perform the whole visit.
 *
 * `barbers` must already be qualified — pass the result of
 * `qualifiedBarbers()` so an employee who does not do a service never shows
 * up as "any available barber".
 */
export async function firstAvailable(
  barbers: string[],
  time: number,
  options: { date?: string; days?: number } = {},
): Promise<Candidate | null> {
  const clock = shopClock();
  const from = options.date && options.date >= clock.date ? options.date : clock.date;
  const span = Math.min(HORIZON_DAYS, Math.max(1, options.days ?? 14));

  let best: Candidate | null = null;

  for (const barber of barbers) {
    for (let offset = 0; offset < span; offset += 1) {
      const date = addDays(from, offset);
      if (best && date > best.date) break;

      const slots = await getSlots({ barber, date, time });
      if (slots.length === 0) continue;

      const candidate = { barber, date, start: slots[0].start };
      if (
        !best ||
        candidate.date < best.date ||
        (candidate.date === best.date && candidate.start < best.start)
      ) {
        best = candidate;
      }
      break;
    }
  }

  return best;
}

/** A day-by-day map of whether a professional has anything open. */
export async function openDays(
  barberId: string,
  time: number,
  days = 30,
): Promise<Array<{ date: string; free: number }>> {
  const clock = shopClock();
  const out: Array<{ date: string; free: number }> = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(clock.date, offset);
    const slots = await getSlots({ barber: barberId, date, time });
    if (slots.length > 0) out.push({ date, free: slots.length });
  }

  return out;
}

/** True when a professional has at least one slot on a given day. */
export async function hasFreeSlot(barberId: string, date: string, time: number): Promise<boolean> {
  const slots = await getSlots({ barber: barberId, date, time });
  return slots.length > 0;
}

/** Row helper shared by the discovery filters. */
export function rowMinutes(row: Row): number {
  return num(row.end) - num(row.start);
}

export function rowOwner(row: Row): string {
  return str(row.barber);
}
