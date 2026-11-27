import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, clean, create, list, num, remove, str, update } from "./crud";
import { addDays, isDate, shopClock, weekday } from "./time";
import type { BreakRow, DayRow, HourRow, Scope } from "./types";

/**
 * Working time for one owner — a professional (`scope: "barber"`) or a branch
 * (`scope: "branch"`).
 *
 * The `barber` column holds the owner id in both cases; the key name predates
 * the team model and renaming it would drop live rows. Always filter on both
 * `barber` and `kind` so a professional and a branch can never cross over.
 */

const MAX_ROWS = 40;

function ownerQueries(owner: string, scope: Scope): string[] {
  return [Query.equal("barber", owner), Query.equal("kind", scope)];
}

/* ------------------------------------------------------------------- reads */

/** Weekly windows for one owner. Empty array = closed every day. */
export async function getHours(owner: string, scope: Scope): Promise<HourRow[]> {
  const rows = await list(TABLES.hours, [
    ...ownerQueries(owner, scope),
    Query.limit(MAX_ROWS),
  ]);
  return rows
    .map((row) => ({
      day: num(row.day),
      start: num(row.start),
      end: num(row.end),
      scope,
    }))
    .filter((row) => row.end > row.start)
    .sort((a, b) => a.day - b.day || a.start - b.start);
}

/** Recurring breaks (lunch, prayers) for one owner. */
export async function getBreaks(owner: string, scope: Scope): Promise<BreakRow[]> {
  const rows = await list(TABLES.breaks, [
    ...ownerQueries(owner, scope),
    Query.limit(MAX_ROWS),
  ]);
  return rows
    .map((row) => ({
      day: num(row.day),
      start: num(row.start),
      end: num(row.end),
      note: str(row.note),
      scope,
    }))
    .filter((row) => row.end > row.start)
    .sort((a, b) => a.day - b.day || a.start - b.start);
}

/** The override stored for one date, or null when the week applies. */
export async function getDay(
  owner: string,
  date: string,
  scope: Scope,
): Promise<DayRow | null> {
  if (!isDate(date)) return null;
  const rows = await list(TABLES.days, [
    ...ownerQueries(owner, scope),
    Query.equal("date", date),
    Query.limit(1),
  ]);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    date,
    open: bool(row.open),
    start: num(row.start),
    end: num(row.end),
    note: str(row.note),
    scope,
  };
}

/** Every date override an owner has set, from `from` onwards. */
export async function listDays(
  owner: string,
  scope: Scope,
  from = shopClock().date,
): Promise<DayRow[]> {
  const rows = await list(TABLES.days, [
    ...ownerQueries(owner, scope),
    Query.greaterThanEqual("date", from),
    Query.orderAsc("date"),
    Query.limit(MAX_ROWS),
  ]);
  return rows.map((row) => ({
    date: str(row.date),
    open: bool(row.open),
    start: num(row.start),
    end: num(row.end),
    note: str(row.note),
    scope,
  }));
}

/* ------------------------------------------------------------------ writes */

/** Replace one owner's whole weekly template in one call. */
export async function setHours(
  owner: string,
  scope: Scope,
  windows: Array<{ day: number; start: number; end: number }>,
): Promise<void> {
  const current = await list(TABLES.hours, [
    ...ownerQueries(owner, scope),
    Query.limit(MAX_ROWS),
  ]);

  const kept = windows
    .filter((row) => row.day >= 0 && row.day <= 6 && row.end > row.start)
    .map((row) => ({
      day: row.day,
      start: Math.max(0, Math.min(1439, Math.round(row.start))),
      end: Math.max(0, Math.min(1440, Math.round(row.end))),
    }))
    .sort((a, b) => a.day - b.day || a.start - b.start);

  const signature = (row: { day: number; start: number; end: number }) =>
    `${row.day}:${row.start}:${row.end}`;

  const wanted = new Set(kept.map(signature));

  // Rows that survived the edit keep their document id, so nothing else that
  // points at them breaks.
  await Promise.all(
    current
      .filter((row) => !wanted.has(signature({ day: num(row.day), start: num(row.start), end: num(row.end) })))
      .map((row) => remove(TABLES.hours, row.$id)),
  );

  const present = new Set(
    current.map((row) => signature({ day: num(row.day), start: num(row.start), end: num(row.end) })),
  );

  await Promise.all(
    kept
      .filter((row) => !present.has(signature(row)))
      .map((row) =>
        create(TABLES.hours, {
          barber: owner,
          kind: scope,
          day: row.day,
          start: row.start,
          end: row.end,
        }),
      ),
  );
}

/** Add a recurring break. Repeated submits with the same shape are ignored. */
export async function addBreak(input: {
  owner: string;
  scope: Scope;
  day: number;
  start: number;
  end: number;
  note?: string;
}): Promise<void> {
  if (input.end <= input.start) return;
  const existing = await getBreaks(input.owner, input.scope);
  const clash = existing.some(
    (row) =>
      row.day === input.day &&
      input.start < row.end &&
      row.start < input.end,
  );
  if (clash) return;

  await create(TABLES.breaks, {
    barber: input.owner,
    kind: input.scope,
    day: input.day,
    start: Math.round(input.start),
    end: Math.round(input.end),
    note: clean(input.note ?? "", 64),
  });
}

export async function removeBreak(id: string): Promise<void> {
  await remove(TABLES.breaks, id);
}

/** Set, replace or clear the override for a single date. */
export async function setDay(input: {
  owner: string;
  scope: Scope;
  date: string;
  open: boolean;
  start?: number;
  end?: number;
  note?: string;
}): Promise<void> {
  if (!isDate(input.date)) throw new Error("bad_date");

  const existing = await list(TABLES.days, [
    ...ownerQueries(input.owner, input.scope),
    Query.equal("date", input.date),
    Query.limit(1),
  ]);

  const data = {
    open: input.open,
    start: Math.max(0, Math.min(1439, Math.round(input.start ?? 0))),
    end: Math.max(0, Math.min(1440, Math.round(input.end ?? 0))),
    note: clean(input.note ?? "", 64),
  };

  if (existing.length > 0) {
    // An open override with no times means "back to the weekly template".
    if (input.open && !input.start && !input.end && !input.note) {
      await remove(TABLES.days, existing[0].$id);
      return;
    }
    await update(TABLES.days, existing[0].$id, data);
    return;
  }

  if (input.open && !input.start && !input.end && !input.note) return;

  await create(TABLES.days, {
    barber: input.owner,
    kind: input.scope,
    date: input.date,
    ...data,
  });
}

export async function clearDay(owner: string, scope: Scope, date: string): Promise<void> {
  const rows = await list(TABLES.days, [
    ...ownerQueries(owner, scope),
    Query.equal("date", date),
    Query.limit(1),
  ]);
  await Promise.all(rows.map((row) => remove(TABLES.days, row.$id)));
}

/** Bulk closure — holidays, vacation, a sick week. */
export async function closeRange(input: {
  owner: string;
  scope: Scope;
  from: string;
  to: string;
  note?: string;
}): Promise<number> {
  if (!isDate(input.from) || !isDate(input.to) || input.to < input.from) return 0;

  let created = 0;
  let cursor = input.from;
  while (cursor <= input.to && created < 90) {
    await setDay({
      owner: input.owner,
      scope: input.scope,
      date: cursor,
      open: false,
      note: input.note ?? "Closed",
    });
    created += 1;
    cursor = addDays(cursor, 1);
  }
  return created;
}

/** Copy this week's template onto the next one, day for day. */
export async function cloneWeek(owner: string, scope: Scope): Promise<void> {
  const hours = await getHours(owner, scope);
  const today = shopClock().date;
  // Sunday of next week.
  const target = addDays(today, 7 - weekday(today));

  // One override per date: fold the day's windows into its outer bounds.
  // Recurring breaks need no copy — they already apply every matching weekday.
  const byDay = new Map<number, { start: number; end: number }>();
  for (const row of hours) {
    const current = byDay.get(row.day);
    byDay.set(row.day, {
      start: Math.min(current?.start ?? row.start, row.start),
      end: Math.max(current?.end ?? row.end, row.end),
    });
  }

  for (const [day, window] of byDay) {
    await setDay({
      owner,
      scope,
      date: addDays(target, day),
      open: true,
      start: window.start,
      end: window.end,
      note: "Template",
    });
  }
}

/* ------------------------------------------------------------- convenience */

export async function getBarberHours(barberId: string): Promise<HourRow[]> {
  return getHours(barberId, "barber");
}

export async function getBarberDay(barberId: string, date: string): Promise<DayRow | null> {
  return getDay(barberId, date, "barber");
}
