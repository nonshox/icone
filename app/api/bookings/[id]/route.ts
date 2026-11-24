import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getBooking, setBookingStatus } from "@/lib/domain/data";
import { currentMember, isStaff } from "@/lib/domain/member";
import { isPast } from "@/lib/domain/time";
import { enrich } from "@/lib/domain/views";
import { apiError, isSameOrigin } from "@/lib/http";

const bodySchema = z.object({
  status: z.enum(["cancel", "done", "noshow"]),
});

type Context = { params: Promise<{ id: string }> };

/** GET /api/bookings/:id — the owner or staff can read one booking. */
export async function GET(_request: NextRequest, context: Context) {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  const { id } = await context.params;

  try {
    const booking = await getBooking(id);
    if (!booking) return apiError("Booking not found.", 404, "not_found");

    const staff = isStaff(member.profile.role);
    if (booking.user !== member.user.id && !staff) {
      return apiError("This booking is not yours.", 403, "forbidden");
    }

    const [row] = await enrich([booking], { withUser: staff });
    return NextResponse.json({ ok: true as const, booking: row });
  } catch (error) {
    console.error("[api] booking read failed", error);
    return apiError("Could not load the booking.", 502, "booking_failed");
  }
}

/**
 * PATCH /api/bookings/:id
 * Members may cancel their own future booking. Staff may also close it out.
 */
export async function PATCH(request: NextRequest, context: Context) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Unknown booking status.", 400, "bad_status");
  }

  try {
    const booking = await getBooking(id);
    if (!booking) return apiError("Booking not found.", 404, "not_found");

    const owner = booking.user === member.user.id;
    const staff = isStaff(member.profile.role);

    if (!owner && !staff) {
      return apiError("This booking is not yours.", 403, "forbidden");
    }

    if (owner && !staff && parsed.data.status !== "cancel") {
      return apiError("You can only cancel your own booking.", 403, "forbidden");
    }

    if (owner && !staff && isPast(booking.date, booking.start)) {
      return apiError(
        "This visit already started. Message the shop to change it.",
        409,
        "too_late",
      );
    }

    if (booking.status === parsed.data.status) {
      const [row] = await enrich([booking]);
      return NextResponse.json({ ok: true as const, booking: row });
    }

    const updated = await setBookingStatus(id, parsed.data.status);
    const [row] = await enrich([updated], { withUser: staff });

    return NextResponse.json({ ok: true as const, booking: row });
  } catch (error) {
    console.error("[api] booking update failed", error);
    return apiError("Could not update the booking.", 502, "update_failed");
  }
}
