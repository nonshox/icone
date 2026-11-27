import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { count, create, first, list, num, str, update, type Row } from "./crud";
import {
  HORIZON_DAYS,
  LEAD_MINUTES,
  busyFor,
  getSlots,
  isBookableDate,
  isFree,
} from "./availability";
import { resolveOffer, servicesFor } from "./catalog";
import { getBarber, isBookable } from "./professional";
import { getBranch, getBusiness } from "./business";
import { shopClock, today } from "./time";
import { visitPrice } from "./pricing";
import type { Booking, OfferedService, Source, Status } from "./types";

export type BookFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type BookResult = { ok: true; booking: Booking } | BookFailure;

const fail = (status: number, code: string, message: string): BookFailure => ({
  ok: false,
  status,
  code,
  message,
});

/** How long the visit occupies, including the longest buffer in play. */
export function visitDuration(offers: OfferedService[], barberBuffer: number): number {
  const work = offers.reduce((total, offer) => total + offer.ownTime, 0);
  const buffer = Math.max(barberBuffer, ...offers.map((offer) => offer.buffer), 0);
  return work + buffer;
}

/* ------------------------------------------------------------ persistence */

function toBooking(row: Row): Booking {
  const status = normalizeStatus(str(row.status));
  return {
    id: row.$id,
    user: str(row.user),
    client: str(row.client),
    barber: str(row.barber),
    service: str(row.service),
    items: parseItems(row.items),
    business: str(row.business),
    branch: str(row.branch),
    date: str(row.date),
    start: num(row.start),
    end: num(row.end),
    price: num(row.price),
    status,
    source: (str(row.source, "online") || "online") as Source,
    note: str(row.note),
    innote: str(row.innote),
    createdby: str(row.createdby),
    created: row.$createdAt,
  };
}

function parseItems(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Rows written before the team model used shorter status names. Read both so
 * nothing in the old history disappears or renders blank.
 */
export function normalizeStatus(value: string): Status {
  switch (value) {
    case "booked":
    case "accepted":
      return "confirmed";
    case "cancel":
      return "cancelled";
    case "done":
      return "done";
    case "noshow":
      return "noshow";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    default:
      // A corrupt or unknown value must never silently hold a slot open.
      console.error("[booking] unknown status", value);
      return "cancelled";
  }
}

export { toBooking };

/** Every holding appointment on one professional's day. */
async function holding(barberId: string, date: string): Promise<Booking[]> {
  const rows = await list(TABLES.bookings, [
    Query.equal("barber", barberId),
    Query.equal("date", date),
    Query.equal("status", ["pending", "confirmed", "done"]),
    Query.limit(200),
  ]);
  return rows.map(toBooking);
}

/**
 * Decide who wins a race for the same interval.
 *
 * Two requests can both pass the availability check and both insert. Ordering
 * by creation time and then document id gives both racers the same answer, so
 * exactly one keeps the slot and the other deletes its own row instead of
 * leaving a double booking behind.
 */
function winnerOf(rows: Booking[], candidate: Booking): boolean {
  const ordered = [...rows].sort((a, b) =>
    a.created === b.created ? (a.id < b.id ? -1 : 1) : a.created < b.created ? -1 : 1,
  );
  return ordered[0]?.id === candidate.id;
}

/* --------------------------------------------------------------- booking */

export type BookInput = {
  /** Signed-in customer. Empty only for walk-ins created by staff. */
  user: string;
  /** Walk-in customer record, when there is no account. */
  client?: string;
  barber: string;
  /** Every service in the visit, in the order they will be performed. */
  services: string[];
  date: string;
  start: number;
  note?: string;
  /** Set by staff routes; customers can never choose this. */
  source?: Source;
  createdby?: string;
  /** Staff can book straight into a confirmed state (walk-ins). */
  forceStatus?: Status;
};

/**
 * Create an appointment after re-validating everything server-side.
 *
 * Availability is never trusted from the client: services, prices, durations,
 * working hours, breaks, exceptions and existing appointments are all read
 * again here before a row is written.
 */
export async function book(input: BookInput): Promise<BookResult> {
  if (!isBookableDate(input.date)) {
    return fail(400, "bad_date", `Pick a date inside the next ${HORIZON_DAYS} days.`);
  }

  if (!Array.isArray(input.services) || input.services.length === 0) {
    return fail(400, "no_service", "Choose at least one service.");
  }

  const barber = await getBarber(input.barber);
  if (!barber || !isBookable(barber)) {
    return fail(404, "no_barber", "That barber is not taking bookings.");
  }

  if (barber.business) {
    const business = await getBusiness(barber.business);
    if (!business || business.state !== "active" || !business.active) {
      return fail(404, "no_barber", "That barbershop is not taking bookings.");
    }
  }
  if (barber.branch) {
    const branch = await getBranch(barber.branch);
    if (branch && !branch.active) {
      return fail(404, "no_barber", "That branch is closed.");
    }
  }

  // Resolve each service against this specific employee: a shared service is
  // only bookable through an employee it is assigned to, and a retired or
  // unassigned service never reaches the calendar.
  const offers: OfferedService[] = [];
  for (const serviceId of input.services) {
    const offer = await resolveOffer(input.barber, serviceId);
    if (!offer || !offer.active) {
      return fail(404, "no_service", "One of those services is no longer offered.");
    }
    offers.push(offer);
  }

  const clock = shopClock();
  const start = Math.round(input.start);
  if (start < 0 || start > 1439) {
    return fail(400, "bad_time", "Pick one of the offered times.");
  }

  if (input.date === clock.date && start < clock.minutes + LEAD_MINUTES) {
    return fail(
      409,
      "too_soon",
      `Pick a time at least ${LEAD_MINUTES} minutes from now.`,
    );
  }

  const duration = visitDuration(offers, barber.buffer);
  const end = start + duration;

  const free = await isFree({ barber: barber.id, date: input.date, start, end });
  if (!free) {
    return fail(409, "slot_taken", "That slot just went. Pick another time.");
  }

  // One customer cannot hold two overlapping visits anywhere.
  if (input.user) {
    const mine = await list(TABLES.bookings, [
      Query.equal("user", input.user),
      Query.equal("date", input.date),
      Query.equal("status", ["pending", "confirmed", "done"]),
      Query.limit(100),
    ]);
    const clash = mine.some((row) => {
      const booking = toBooking(row);
      return start < booking.end && booking.start < end;
    });
    if (clash) {
      return fail(409, "already_booked", "You already have an appointment at that time.");
    }
  }

  const status: Status =
    input.forceStatus ?? (barber.confirm ? "pending" : "confirmed");

  const row = await create(TABLES.bookings, {
    user: input.user,
    client: input.client ?? "",
    barber: barber.id,
    service: offers[0].id,
    items: JSON.stringify(offers.map((offer) => offer.id)),
    business: barber.business,
    branch: barber.branch,
    date: input.date,
    start,
    end,
    price: visitPrice(offers),
    status,
    source: input.source ?? "online",
    note: (input.note ?? "").slice(0, 256),
    innote: "",
    createdby: input.createdby ?? "",
  });

  const booking = toBooking(row);

  // Verify after the fact. If we lost a race, the oldest insert keeps the
  // slot and we clean up our own row rather than double-book the professional.
  const competing = (await holding(barber.id, input.date)).filter(
    (other) => other.start < booking.end && booking.start < other.end,
  );

  if (competing.length > 0 && !winnerOf(competing, booking)) {
    await cancelBooking(booking.id, input.createdby ?? input.user, "lost_race", booking.status);
    return fail(409, "slot_taken", "That slot just went. Pick another time.");
  }

  // Two requests from the same customer at different barbers can both pass
  // the pre-flight check. Resolve that after insert as well: the later row
  // loses and is cancelled rather than holding two overlapping visits.
  if (input.user) {
    const mine = await list(TABLES.bookings, [
      Query.equal("user", input.user),
      Query.equal("date", input.date),
      Query.equal("status", ["pending", "confirmed", "done"]),
      Query.limit(100),
    ]);
    const rivals = mine
      .filter((row) => row.$id !== booking.id)
      .map(toBooking)
      .filter((row) => start < row.end && row.start < end);
    if (rivals.length > 0 && !winnerOf([...rivals, booking], booking)) {
      await cancelBooking(booking.id, input.createdby ?? input.user, "duplicate", booking.status);
      return fail(409, "already_booked", "You already have an appointment at that time.");
    }
  }

  await logStatus(booking.id, "", status, input.createdby ?? input.user, "created");

  return { ok: true, booking };
}

/** Cancel instead of delete: the attempt stays in the audit trail. */
async function cancelBooking(
  id: string,
  by: string,
  reason: string,
  from: Status = "pending",
): Promise<void> {
  await update(TABLES.bookings, id, { status: "cancelled" });
  await logStatus(id, from, "cancelled", by, "conflict", reason);
}

/** Append one row to an appointment's status history. Best effort. */
export async function logStatus(
  booking: string,
  from: Status | "",
  to: Status,
  by: string,
  kind = "status",
  note = "",
): Promise<void> {
  try {
    await create(TABLES.apptlog, {
      booking,
      from,
      to,
      by,
      note: note.slice(0, 256),
      kind,
    });
  } catch (error) {
    console.error("[domain] appointment log failed", error);
  }
}

/**
 * Settlement sweep for insert-then-verify races that were interrupted (a
 * worker died after insert, before the loser could be cancelled). Keeps one
 * deterministic winner per overlapping interval and closes the rest, always
 * with an audit row — never a silent delete.
 */
export async function reconcileBookings(): Promise<number> {
  const rows: Row[] = [];
  const page = 200;
  for (let offset = 0; offset < 4000; offset += page) {
    const batch = await list(TABLES.bookings, [
      Query.greaterThanEqual("date", today()),
      Query.limit(page),
      Query.offset(offset),
    ]);
    rows.push(...batch);
    if (batch.length < page) break;
  }

  const groups = new Map<string, Booking[]>();
  for (const row of rows) {
    const booking = toBooking(row);
    if (!["pending", "confirmed", "done"].includes(booking.status)) continue;
    const key = `${booking.barber}|${booking.date}`;
    const list = groups.get(key) ?? [];
    list.push(booking);
    groups.set(key, list);
  }

  let closed = 0;
  for (const candidates of groups.values()) {
    const sorted = [...candidates].sort((a, b) => a.start - b.start || a.end - b.end);
    const kept: Booking[] = [];
    for (const row of sorted) {
      const overlap = kept.filter(
        (other) => row.start < other.end && other.start < row.end,
      );
      if (overlap.length === 0) {
        kept.push(row);
        continue;
      }
      // The earliest insert wins; `$id` is the deterministic tie-breaker.
      const winner = [...overlap, row].sort((a, b) =>
        a.created === b.created ? (a.id < b.id ? -1 : 1) : a.created < b.created ? -1 : 1,
      )[0];
      if (winner.id === row.id) {
        kept.push(row);
      } else {
        await cancelBooking(row.id, "reconcile", "conflict", row.status);
        closed += 1;
      }
    }
  }
  return closed;
}

/* ------------------------------------------------------- staff-side entry */

/**
 * Register a customer who walked in or phoned, blocking the calendar exactly
 * like an online booking would.
 */
export async function bookWalkin(input: {
  staff: string;
  barber: string;
  client?: string;
  user?: string;
  services: string[];
  date: string;
  start: number;
  note?: string;
  innote?: string;
}): Promise<BookResult> {
  const result = await book({
    user: input.user ?? "",
    client: input.client ?? "",
    barber: input.barber,
    services: input.services,
    date: input.date,
    start: input.start,
    note: input.note,
    source: "walkin",
    createdby: input.staff,
    forceStatus: "confirmed",
  });

  if (result.ok && input.innote) {
    await update(TABLES.bookings, result.booking.id, {
      innote: input.innote.slice(0, 512),
    });
  }

  return result;
}

/* -------------------------------------------------------------- reschedule */

/**
 * Move an appointment to a new time, re-checking the target slot first and
 * releasing the old one in the same call.
 */
export async function reschedule(input: {
  booking: Booking;
  date: string;
  start: number;
  by: string;
}): Promise<BookResult> {
  const { booking } = input;
  if (!isBookableDate(input.date)) {
    return fail(400, "bad_date", "That date is too far away.");
  }
  if (!Number.isInteger(input.start) || input.start < 0 || input.start > 1439) {
    return fail(400, "bad_time", "Pick a valid start time.");
  }
  const clock = shopClock();
  if (
    input.date < clock.date ||
    (input.date === clock.date && input.start - clock.minutes < LEAD_MINUTES)
  ) {
    return fail(400, "too_soon", "That time is too soon.");
  }

  const offers: OfferedService[] = [];
  for (const serviceId of booking.items.length > 0 ? booking.items : [booking.service]) {
    const offer = await resolveOffer(booking.barber, serviceId);
    if (offer) offers.push(offer);
  }
  if (offers.length === 0) {
    return fail(404, "no_service", "That service no longer exists.");
  }

  const barber = await getBarber(booking.barber);
  if (!barber || !isBookable(barber)) {
    return fail(404, "no_barber", "That barber is not available.");
  }

  const duration = visitDuration(offers, barber.buffer);
  const end = input.start + duration;

  // Working hours, breaks, date exceptions and every other holding booking are
  // checked with the old row excluded. `isFree` alone would count this row.
  const busy = (await busyFor(barber.id, input.date)).filter(
    (row) => row.id !== booking.id,
  );
  const overlaps = busy.some((row) => input.start < row.end && row.start < end);
  if (overlaps) {
    return fail(409, "slot_taken", "That time is already taken.");
  }
  const slot = (await getSlots({ barber: barber.id, date: input.date, time: duration }))
    .find((candidate) => candidate.start === input.start);
  if (!slot) {
    return fail(409, "slot_taken", "That time is not available.");
  }

  const previous = `${booking.date} ${booking.start}`;

  const row = await update(TABLES.bookings, booking.id, {
    date: input.date,
    start: input.start,
    end,
  });

  await logStatus(
    booking.id,
    booking.status,
    booking.status,
    input.by,
    "rescheduled",
    previous,
  );

  return { ok: true, booking: toBooking(row) };
}

/* ---------------------------------------------------------------- queries */

export async function getBooking(id: string): Promise<Booking | null> {
  const row = await first(TABLES.bookings, [Query.equal("$id", id)]);
  return row ? toBooking(row) : null;
}

export async function countBookings(queries: string[]): Promise<number> {
  return count(TABLES.bookings, queries);
}

/** Slots still offered for a professional, used to re-render after a booking. */
export async function refreshSlots(
  barberId: string,
  date: string,
  time: number,
): Promise<Array<{ start: number; end: number; label: string }>> {
  return getSlots({ barber: barberId, date, time });
}

/** Services that were booked together, resolved for display. */
export async function bookingOffers(booking: Booking): Promise<OfferedService[]> {
  const ids = booking.items.length > 0 ? booking.items : [booking.service];
  const all = await servicesFor(booking.barber);
  const byId = new Map(all.map((offer) => [offer.id, offer]));
  return ids.map((id) => byId.get(id)).filter((offer): offer is OfferedService => !!offer);
}
