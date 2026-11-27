import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { can } from "@/lib/domain/access";
import { apiError, isSameOrigin } from "@/lib/http";
import { createClient, findClient } from "@/lib/domain/appointment";
import { bookWalkin } from "@/lib/domain/booking";
import { getBarber } from "@/lib/domain/professional";
import { notify } from "@/lib/domain/notify";
import { toBookingRows } from "@/lib/domain/appointment";

const schema = z.object({
  barber: z.string().trim().min(1).max(36),
  services: z.array(z.string().trim().min(1).max(36)).min(1).max(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  name: z.string().trim().min(1).max(64),
  phone: z.string().trim().max(32).default(""),
  note: z.string().trim().max(200).default(""),
});

/** POST /api/walkins — register an arrival as a real, slot-blocking booking. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const session = await requireUser();
  if (!session.ok) return session.response;

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

    const actor = session.actor;
    const permitted = can(actor, "appointment.create", {
      barber: barber.id,
      business: barber.business,
    });
    if (!permitted) {
      return apiError("You cannot create visits for this professional.", 403, "forbidden");
    }
    const business = barber.business;

    const found = await findClient({
      business,
      phone: parsed.data.phone,
      user: actor.barber?.id === barber.id ? actor.userId : undefined,
    });
    const client =
      found ??
      (await createClient({
        business,
        barber: barber.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
      }));

    const result = await bookWalkin({
      staff: actor.userId,
      barber: barber.id,
      client: client.id,
      services: parsed.data.services,
      date: parsed.data.date,
      start: parsed.data.start,
      note: parsed.data.note,
    });
    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    const [booking] = await toBookingRows([result.booking]);
    if (barber.user) {
      await notify({
        userId: barber.user,
        key: "booked",
        params: { date: booking.date, time: String(booking.start) },
        link: `/bookings/${booking.id}`,
      }).catch((error) => console.error("[walkin] notice failed", error));
    }

    return NextResponse.json({ ok: true as const, booking }, { status: 201 });
  } catch (error) {
    console.error("[api] walk-in failed", error);
    return apiError("Could not register the visit.", 502, "walkin_failed");
  }
}
