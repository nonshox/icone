import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { can } from "@/lib/domain/access";
import {
  createClient,
  findClient,
  toBookingRows,
  toClient,
} from "@/lib/domain/appointment";
import { bookWalkin } from "@/lib/domain/booking";
import { get, str } from "@/lib/domain/crud";
import { getBarber } from "@/lib/domain/professional";
import { notify } from "@/lib/domain/notify";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { label } from "@/lib/domain/time";

const schema = z.object({
  barber: z.string().trim().min(1).max(36),
  services: z.array(z.string().trim().min(1).max(36)).min(1).max(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  /** Existing client record id, or a member id without a CRM record. */
  client: z.string().trim().min(1).max(36).optional(),
  /** Signed-in member this visit belongs to. */
  user: z.string().trim().min(1).max(36).optional(),
  name: z.string().trim().max(64).default(""),
  phone: z.string().trim().max(32).default(""),
  note: z.string().trim().max(200).default(""),
  source: z.enum(["walkin", "phone", "manual"]).default("walkin"),
});

/**
 * POST /api/walkins — register an arrival as a real, slot-blocking booking.
 *
 * Every professional-side entry point (calendar slot, walk-in page and
 * waitlist deep link) funnels through this one route.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const session = await requireUser();
  if (!session.ok) return session.response;

  const actor = session.actor;
  const limit = await rateLimit(`walkin:${actor.userId}`, 12, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the visit details and try again.", 400, "invalid_walkin");
  }

  try {
    const barber = await getBarber(parsed.data.barber);
    if (!barber) return apiError("Professional not found.", 404, "no_barber");

    const permitted = can(actor, "appointment.create", {
      barber: barber.id,
      business: barber.business,
    });
    if (!permitted) {
      return apiError("You cannot create visits for this professional.", 403, "forbidden");
    }
    const business = barber.business;

    const identity = parsed.data.user || parsed.data.client || "";
    const found = await findClient({
      business,
      phone: parsed.data.phone,
      user:
        parsed.data.user ||
        (parsed.data.client
          ? identity
          : actor.barber?.id === barber.id
            ? actor.userId
            : undefined),
    });

    let client = found;
    if (!client && parsed.data.client) {
      const row = await get(TABLES.clients, parsed.data.client).catch(() => null);
      if (row && str(row.business) !== business) {
        return apiError("That customer is not in this workspace.", 404, "no_client");
      }
      if (row) client = toClient(row);
    }

    // A member id may arrive without a CRM row yet; `createClient` links it.
    const bookingUser =
      client?.user ||
      parsed.data.user ||
      (!found && parsed.data.client ? parsed.data.client : "");
    client ??= await createClient({
      business,
      barber: barber.id,
      user: bookingUser || undefined,
      name: parsed.data.name,
      phone: parsed.data.phone,
    });

    const result = await bookWalkin({
      staff: actor.userId,
      barber: barber.id,
      client: client.id,
      user: bookingUser || undefined,
      services: parsed.data.services,
      date: parsed.data.date,
      start: parsed.data.start,
      note: parsed.data.note,
      source: parsed.data.source,
    });
    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    const booking = result.booking;

    const [row] = await toBookingRows([result.booking]);
    if (barber.user) {
      await notify({
        userId: barber.user,
        key: "booked",
        params: {
          date: booking.date,
          time: label(booking.start),
          barber: row.barberName,
        },
        link: `/agenda?date=${encodeURIComponent(booking.date)}&booking=${encodeURIComponent(booking.id)}`,
      }).catch((error) => console.error("[walkin] notice failed", error));
    }

    return NextResponse.json({ ok: true as const, booking }, { status: 201 });
  } catch (error) {
    console.error("[api] walk-in failed", error);
    return apiError("Could not register the visit.", 502, "walkin_failed");
  }
}
