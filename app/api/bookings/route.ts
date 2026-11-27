import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { can, inBusiness, onBarber, readableBarbers } from "@/lib/domain/access";
import { toBooking, book } from "@/lib/domain/booking";
import { toBookingRow, toBookingRows } from "@/lib/domain/appointment";
import { list } from "@/lib/domain/crud";
import {
  appointmentParams,
  businessAudience,
  notify,
  notifyMany,
} from "@/lib/domain/notify";
import { getBarber, getBarbers } from "@/lib/domain/professional";
import { isDate } from "@/lib/domain/time";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z
  .object({
    barber: z.string().trim().min(1).max(36),
    /** Every service in the visit, in the order they will be performed. */
    services: z.array(z.string().trim().min(1).max(36)).min(1).max(10).optional(),
    /** Legacy single-service field, still accepted by older deep links. */
    service: z.string().trim().min(1).max(36).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.number().int().min(0).max(1439),
    note: z.string().trim().max(200).default(""),
  })
  .refine((body) => Boolean(body.services?.length || body.service), {
    message: "Choose at least one service.",
    path: ["services"],
  });

/** Booking rows with the flag both visit views use for the review form. */
async function withReviewed(bookings: Awaited<ReturnType<typeof toBookingRows>>) {
  if (bookings.length === 0) return bookings;
  const ids = new Set(
    bookings.map((booking) => booking.id),
  );
  const rows = await list(TABLES.reviews, [
    Query.equal("booking", [...ids]),
    Query.limit(100),
  ]);
  const reviewed = new Set(rows.map((row) => String(row.booking)));
  return bookings.map((booking) => ({
    ...booking,
    reviewed: reviewed.has(booking.id),
  }));
}

/**
 * GET /api/bookings — the member's bookings.
 * GET /api/bookings?date=YYYY-MM-DD — a staff agenda for one day.
 */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const params = request.nextUrl.searchParams;
  const date = params.get("date");

  try {
    if (date) {
      if (!isDate(date)) {
        return apiError("Pick a valid date.", 400, "bad_date");
      }

      const staff = actor.profile.role === "admin" || actor.summary.staff;
      if (!staff) {
        return apiError("You do not have access to this.", 403, "forbidden");
      }

      let barberId = params.get("barber") ?? undefined;
      if (barberId && actor.profile.role !== "admin") {
        const requested = await getBarber(barberId);
        if (!requested) {
          return apiError("Professional not found.", 404, "no_barber");
        }
        const permitted =
          onBarber(actor, barberId) ||
          (Boolean(requested.business) && inBusiness(actor, requested.business));
        if (!permitted) {
          return apiError("You do not have access to this calendar.", 403, "forbidden");
        }
        const readable =
          actor.barber?.id === barberId
            ? can(actor, "calendar.read", {
                barber: barberId,
                business: requested.business,
              })
            : can(actor, "calendar.read.all", { business: requested.business });
        if (!readable) {
          return apiError("You cannot read this calendar.", 403, "forbidden");
        }
      }
      if (actor.profile.role === "barber" && !barberId) {
        if (!actor.barber) {
          return apiError(
            "Your account is not linked to a chair yet.",
            403,
            "no_chair",
          );
        }
        barberId = actor.barber.id;
      }

      const candidates = barberId ? [barberId] : await readableBarbers(actor);
      const resolved = await getBarbers(candidates);
      const allowed = candidates.filter((id) => {
        const business = resolved.get(id)?.business;
        return (
          can(actor, "calendar.read", { barber: id, business }) ||
          can(actor, "calendar.read.all", { business })
        );
      });
      if (allowed.length === 0 && actor.profile.role !== "admin") {
        return apiOk({ bookings: [] });
      }

      const queries = [Query.equal("date", date)];
      if (actor.profile.role !== "admin") {
        queries.push(Query.equal("barber", allowed));
      } else if (barberId) {
        queries.push(Query.equal("barber", barberId));
      }

      const rows = await list(TABLES.bookings, [
        ...queries,
        Query.orderAsc("start"),
        Query.limit(200),
      ]);
      return apiOk({ bookings: await toBookingRows(rows.map(toBooking)) });
    }

    const rows = await list(TABLES.bookings, [
      Query.equal("user", actor.userId),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    const bookings = await withReviewed(await toBookingRows(rows.map(toBooking)));
    return apiOk({ bookings });
  } catch (error) {
    console.error("[api] bookings list failed", error);
    return apiError("Could not load bookings.", 502, "bookings_failed");
  }
}

/** POST /api/bookings — reserve a slot. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const limit = rateLimit(`book:${actor.userId}`, 12, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the booking details and try again.", 400, "invalid_booking");
  }

  // keep the legacy primary service first; `book()` resolves every id against
  // this barber and computes one duration and one price for the whole visit.
  const services = [
    ...new Set([
      ...(parsed.data.service ? [parsed.data.service] : []),
      ...(parsed.data.services ?? []),
    ]),
  ].slice(0, 10);

  try {
    const result = await book({
      user: actor.userId,
      barber: parsed.data.barber,
      services,
      date: parsed.data.date,
      start: parsed.data.start,
      note: parsed.data.note,
    });

    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    const row = await toBookingRow(result.booking);
    const params = appointmentParams({
      date: row.date,
      start: row.start,
      barber: row.barberName,
    });
    const link = `/bookings/${row.id}`;

    // Notifications are best effort: a confirmed chair is never rolled back.
    await notify({
      userId: actor.userId,
      key: result.booking.status === "pending" ? "booked" : "confirmed",
      params,
      link,
    }).catch((error) => console.error("[booking] customer notice failed", error));

    const chair = await getBarber(result.booking.barber).catch(() => null);
    const staff = new Set<string>(chair?.user ? [chair.user] : []);
    if (chair?.business) {
      const audience = await businessAudience(chair.business, [
        "owner",
        "manager",
        "reception",
      ]).catch(() => []);
      audience.forEach((id) => staff.add(id));
    }
    if (staff.size > 0) {
      await notifyMany([...staff], { key: "booked", params, link }).catch((error) =>
        console.error("[booking] staff notice failed", error),
      );
    }

    return NextResponse.json(
      { ok: true as const, booking: { ...row, reviewed: false } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api] booking failed", error);
    return apiError("Could not save the booking.", 502, "booking_failed");
  }
}
