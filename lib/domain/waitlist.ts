import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { create, list, remove, update } from "./crud";
import { getSlots } from "./availability";
import { resolveOffer } from "./catalog";
import { notify } from "./notify";
import { shopClock } from "./time";
import type { Waitlist } from "./types";

/**
 * Waitlist.
 *
 * A customer asks for a window instead of a specific time. As soon as an
 * appointment in that window is cancelled or a new opening appears, the
 * eligible people are told through Telegram — the app never books on their
 * behalf, they still choose the slot themselves.
 */

export function toWaitlist(row: {
  $id: string;
  $createdAt?: string;
} & Record<string, unknown>): Waitlist {
  const read = (key: string, fallback: string | number): string | number =>
    typeof row[key] === typeof fallback && row[key] !== undefined
      ? (row[key] as string | number)
      : fallback;

  return {
    id: row.$id,
    user: String(read("user", "")),
    business: String(read("business", "")),
    branch: String(read("branch", "")),
    barber: String(read("barber", "")),
    service: String(read("service", "")),
    from: String(read("from", "")),
    to: String(read("to", "")),
    day: Number(read("day", -1)),
    before: Number(read("before", 1439)),
    note: String(read("note", "")),
    state: String(read("state", "open")) as Waitlist["state"],
  };
}

/** Window sizes a customer can pick from, in days. */
export const WAIT_WINDOWS = [1, 3, 7, 14, 30] as const;

export type WaitInput = {
  user: string;
  barber: string;
  service?: string;
  business?: string;
  branch?: string;
  /** Preferred day of week, 0 = Sunday, or -1 for any day. */
  day?: number;
  /** Only want times before this minute of day. */
  before?: number;
  note?: string;
  /** How many days ahead to look. */
  window?: number;
};

/** Add a request. One open request per person per professional. */
export async function joinWaitlist(input: WaitInput): Promise<Waitlist> {
  const days = Math.max(1, Math.min(60, input.window ?? 7));
  const clock = shopClock();

  const existing = await list(TABLES.waits, [
    Query.equal("user", input.user),
    Query.equal("barber", input.barber),
    Query.equal("state", "open"),
    Query.limit(10),
  ]);

  const data = {
    user: input.user,
    business: input.business ?? "",
    branch: input.branch ?? "",
    barber: input.barber,
    service: input.service ?? "",
    from: clock.date,
    to: addDaysSafe(clock.date, days),
    day: input.day ?? -1,
    before: input.before ?? 1439,
    note: (input.note ?? "").slice(0, 256),
    state: "open",
  };

  if (existing.length > 0) {
    const row = await update(TABLES.waits, existing[0].$id, data);
    return toWaitlist(row);
  }

  const row = await create(TABLES.waits, data);
  return toWaitlist(row);
}

function addDaysSafe(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) return date;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export async function myWaits(userId: string): Promise<Waitlist[]> {
  const rows = await list(TABLES.waits, [
    Query.equal("user", userId),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return rows.map(toWaitlist);
}

export async function waitsForBarber(barberId: string): Promise<Waitlist[]> {
  const rows = await list(TABLES.waits, [
    Query.equal("barber", barberId),
    Query.equal("state", "open"),
    Query.limit(100),
  ]);
  return rows.map(toWaitlist);
}

export async function cancelWait(id: string): Promise<void> {
  await update(TABLES.waits, id, { state: "cancelled" });
}

/**
 * Look for a request we can now satisfy and tell the customer.
 *
 * Returns how many people were notified. The row moves to `notified` before
 * the message goes out, so a repeated run cannot ping the same person twice.
 */
export async function matchWaitlist(barberId?: string): Promise<number> {
  const queries = [Query.equal("state", "open"), Query.limit(50)];
  if (barberId) queries.push(Query.equal("barber", barberId));

  const rows = await list(TABLES.waits, queries);
  const clock = shopClock();
  let notified = 0;

  for (const raw of rows) {
    const wait = toWaitlist(raw);

    if (wait.to < clock.date || wait.from > addDaysSafe(clock.date, 30)) {
      await update(TABLES.waits, wait.id, { state: "expired" });
      continue;
    }

    // Match against the requested service's real duration, not a hardcoded
    // 30-minute gap, and only offer a time the customer would accept.
    let serviceDuration = 30;
    if (wait.service) {
      const offer = await resolveOffer(wait.barber, wait.service);
      if (!offer || !offer.active || !offer.assigned) continue;
      serviceDuration = Math.max(1, offer.ownTime + offer.buffer);
    }
    const from = wait.from < clock.date ? clock.date : wait.from;
    let satisfied = false;

    for (let offset = 0; offset <= daysBetween(from, wait.to) && !satisfied; offset += 1) {
      const date = addDaysSafe(from, offset);

      if (wait.day >= 0 && weekdayOf(date) !== wait.day) continue;

      const slots = await getSlots({ barber: wait.barber, date, time: serviceDuration });
      satisfied = slots.some(
        (slot) => wait.before <= 0 || slot.start <= wait.before,
      );
    }

    if (!satisfied) continue;

    await update(TABLES.waits, wait.id, { state: "notified" });

    const sent = await notify({
      userId: wait.user,
      key: "waitlist",
      link: `/barbers/${wait.barber}`,
    });

    if (sent) notified += 1;
  }

  return notified;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.min(60, Math.round((b - a) / 86_400_000)));
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Close everything that has run out of time. Safe to run every day. */
export async function expireWaits(): Promise<number> {
  const clock = shopClock();
  const rows = await list(TABLES.waits, [
    Query.equal("state", "open"),
    Query.limit(100),
  ]);

  const stale = rows.filter((row) => toWaitlist(row).to < clock.date);
  await Promise.all(stale.map((row) => update(TABLES.waits, row.$id, { state: "expired" })));
  return stale.length;
}

/** Drop a request entirely — used when a customer cancels their account. */
export async function dropWait(id: string): Promise<void> {
  await remove(TABLES.waits, id);
}

/** How many people are waiting for one professional. */
export async function waitCount(barberId: string): Promise<number> {
  const rows = await list(TABLES.waits, [
    Query.equal("barber", barberId),
    Query.equal("state", "open"),
    Query.limit(100),
  ]);
  return rows.length;
}

export function waitSummary(wait: Waitlist): string {
  const parts = [wait.from];
  if (wait.to !== wait.from) parts.push(`→ ${wait.to}`);
  if (wait.day >= 0) parts.push(`day ${wait.day}`);
  return parts.join(" ");
}
