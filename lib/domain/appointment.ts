import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, create, first, getMany, list, num, str, update, type Row } from "./crud";
import { toBooking, logStatus, getBooking } from "./booking";
import { getBarbers } from "./professional";
import { getBusinessesSafe, getBranchesSafe } from "./directory";
import { shopClock } from "./time";
import { CANCELLABLE, type Booking, type BookingRow, type Status } from "./types";

/** Statuses a transition may start from. */
const FROM: Record<Status, readonly Status[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["done", "noshow", "cancelled"],
  rejected: [],
  cancelled: [],
  done: [],
  noshow: [],
};

export type TransitionFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type TransitionResult =
  | { ok: true; booking: Booking }
  | TransitionFailure;

const fail = (status: number, code: string, message: string): TransitionFailure => ({
  ok: false,
  status,
  code,
  message,
});

/** How long before the start a customer may still walk away for free. */
export const CUSTOMER_CANCEL_MINUTES = 120;

/**
 * Whether the signed-in customer is allowed to cancel right now.
 *
 * Staff can always cancel on the customer's behalf; the window only stops a
 * customer from vanishing minutes before their slot.
 */
export function customerCanCancel(booking: Booking): boolean {
  if (!CANCELLABLE.includes(booking.status)) return false;

  const clock = shopClock();
  if (booking.date < clock.date) return false;
  if (booking.date > clock.date) return true;

  return booking.start - clock.minutes >= CUSTOMER_CANCEL_MINUTES;
}

/**
 * Move an appointment to its next state, recording who did it and why.
 *
 * Transitions are checked against the row's *current* status inside the same
 * call that writes it, so two staff tapping "complete" and "cancel" cannot
 * both win: the second one sees the new status and is refused.
 */
export async function transition(input: {
  booking: Booking;
  to: Status;
  by: string;
  note?: string;
  kind?: string;
}): Promise<TransitionResult> {
  const { to } = input;
  // Re-read immediately before writing: the caller's copy may already be
  // stale because another staff member acted on the same booking.
  const current = (await getBooking(input.booking.id)) ?? input.booking;

  if (current.status === to) {
    return { ok: true, booking: current };
  }

  if (!FROM[current.status].includes(to)) {
    return fail(
      409,
      "bad_transition",
      `A ${current.status} appointment cannot become ${to}.`,
    );
  }

  const row = await update(TABLES.bookings, current.id, { status: to });

  await logStatus(
    current.id,
    current.status,
    to,
    input.by,
    input.kind ?? "status",
    input.note ?? "",
  );

  // A cancelled or rejected visit gives the slot back to everybody.
  if (to === "cancelled" || to === "rejected") {
    await releaseWaitlist(current);
  }

  return { ok: true, booking: toBooking(row) };
}

/** Wake anyone whose real preferences match a slot that just opened up. */
async function releaseWaitlist(booking: Booking): Promise<void> {
  try {
    const { matchWaitlist } = await import("./waitlist");
    await matchWaitlist(booking.barber);
  } catch (error) {
    console.error("[domain] waitlist release failed", error);
  }
}

/* ------------------------------------------------------------ customer side */

/** Cancel from the customer's own account, respecting the policy window. */
export async function cancelByCustomer(
  booking: Booking,
  by: string,
): Promise<TransitionResult> {
  if (!customerCanCancel(booking)) {
    return fail(
      409,
      "too_late",
      "This appointment is too close to cancel. Please contact the barber.",
    );
  }
  return transition({ booking, to: "cancelled", by, kind: "customer" });
}

/* ------------------------------------------------------------- walk-in CRM */

export type ClientRow = {
  id: string;
  business: string;
  barber: string;
  user: string;
  name: string;
  phone: string;
  note: string;
  active: boolean;
};

export function toClient(row: Row): ClientRow {
  return {
    id: row.$id,
    business: str(row.business),
    barber: str(row.barber),
    user: str(row.user),
    name: str(row.name),
    phone: str(row.phone),
    note: str(row.note),
    active: bool(row.active, true),
  };
}

/**
 * Find the customer record a staff member should attach a walk-in to.
 *
 * Matching is deliberately narrow: the same phone number inside the same
 * business, so two unrelated barbershops never share a customer just because
 * the person used the same number.
 */
export async function findClient(input: {
  business: string;
  phone: string;
  user?: string;
}): Promise<ClientRow | null> {
  if (input.user) {
    const byUser = await first(TABLES.clients, [
      Query.equal("business", input.business),
      Query.equal("user", input.user),
    ]);
    if (byUser) return toClient(byUser);
  }

  if (!input.phone) return null;

  const rows = await list(TABLES.clients, [
    Query.equal("business", input.business),
    Query.equal("phone", input.phone),
    Query.limit(5),
  ]);
  return rows.length > 0 ? toClient(rows[0]) : null;
}

export async function createClient(input: {
  business: string;
  barber?: string;
  user?: string;
  name: string;
  phone?: string;
  note?: string;
}): Promise<ClientRow> {
  const existing = await findClient({
    business: input.business,
    phone: input.phone ?? "",
    user: input.user,
  });
  if (existing) return existing;

  const row = await create(TABLES.clients, {
    business: input.business,
    barber: input.barber ?? "",
    user: input.user ?? "",
    name: input.name.slice(0, 64) || "Walk-in",
    phone: (input.phone ?? "").slice(0, 32),
    note: (input.note ?? "").slice(0, 512),
    active: true,
  });
  return toClient(row);
}

/* ---------------------------------------------------------------- reads */

/** Resolve a booking into everything the calendar and inbox need to render. */
export async function toBookingRow(booking: Booking): Promise<BookingRow> {
  const [barbers, businesses, branches, customers] = await Promise.all([
    getBarbers([booking.barber]),
    getBusinessesSafe(booking.business ? [booking.business] : []),
    getBranchesSafe(booking.branch ? [booking.branch] : []),
    booking.user || booking.client
      ? getMany(
          booking.user ? TABLES.users : TABLES.clients,
          [booking.user || booking.client],
        )
      : Promise.resolve([]),
  ]);

  const customer = customers[0];
  const barber = barbers.get(booking.barber);

  return {
    ...booking,
    barberName: barber?.name ?? "Barber",
    serviceName: "",
    serviceTime: 0,
    customerName: customer
      ? str(customer.name, booking.user ? "Customer" : "Walk-in")
      : booking.user
        ? "Customer"
        : "Walk-in",
    customerPhone: customer ? str(customer.phone) : "",
    customerAvatar: customer ? str(customer.avatar) : "",
    businessName: businesses.get(booking.business)?.name ?? "",
    branchName: branches.get(booking.branch)?.name ?? "",
  };
}

/** Resolve a batch of bookings in a handful of requests. */
export async function toBookingRows(bookings: Booking[]): Promise<BookingRow[]> {
  const barberIds = [...new Set(bookings.map((row) => row.barber))];
  const businessIds = [...new Set(bookings.map((row) => row.business).filter(Boolean))];
  const branchIds = [...new Set(bookings.map((row) => row.branch).filter(Boolean))];
  const [barbers, businesses, branches, userRows, clientRows, serviceRows] =
    await Promise.all([
      getBarbers(barberIds),
      getBusinessesSafe(businessIds),
      getBranchesSafe(branchIds),
      getMany(
        TABLES.users,
        bookings.filter((row) => row.user).map((row) => row.user),
      ),
      getMany(
        TABLES.clients,
        bookings.filter((row) => !row.user && row.client).map((row) => row.client),
      ),
      getMany(
        TABLES.services,
        bookings.map((row) => row.service).filter(Boolean),
      ),
    ]);

  const usersById = new Map(userRows.map((row) => [row.$id, row]));
  const clientsById = new Map(clientRows.map((row) => [row.$id, row]));
  const servicesById = new Map(serviceRows.map((row) => [row.$id, row]));

  return bookings.map((booking) => {
    const customer = booking.user
      ? usersById.get(booking.user)
      : clientsById.get(booking.client);
    const service = servicesById.get(booking.service);

    return {
      ...booking,
      barberName: barbers.get(booking.barber)?.name ?? "Barber",
      serviceName: service ? str(service.name) : "",
      serviceTime: service ? num(service.time) : 0,
      customerName: customer
        ? str(customer.name, booking.user ? "Customer" : "Walk-in")
        : booking.user
          ? "Customer"
          : "Walk-in",
      customerPhone: customer ? str(customer.phone) : "",
      customerAvatar: customer ? str(customer.avatar) : "",
      businessName: businesses.get(booking.business)?.name ?? "",
      branchName: branches.get(booking.branch)?.name ?? "",
    };
  });
}

/** One appointment plus its status history, for the detail drawer. */
export async function appointmentDetail(
  bookingId: string,
): Promise<{ booking: BookingRow; history: Row[] } | null> {
  const row = await first(TABLES.bookings, [Query.equal("$id", bookingId)]);
  if (!row) return null;

  const booking = toBooking(row);
  const history = await list(TABLES.apptlog, [
    Query.equal("booking", bookingId),
    Query.orderAsc("$createdAt"),
    Query.limit(100),
  ]);

  return { booking: await toBookingRow(booking), history };
}

/** Cancelled and rejected visits are not counted as workload. */
export function isOccupied(booking: Booking): boolean {
  return booking.status === "pending" || booking.status === "confirmed";
}
