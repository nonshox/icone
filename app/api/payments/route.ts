import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getBooking } from "@/lib/domain/data";
import { currentMember } from "@/lib/domain/member";
import {
  canReadPayment,
  canUpdatePayment,
  ensurePayment,
  getPaymentForBooking,
  updatePayment,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type Actor,
} from "@/lib/domain/payments";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const patchSchema = z.object({
  booking: z.string().trim().min(1).max(36),
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS).optional(),
});

/** GET /api/payments?booking=<id> — payment for one visit. */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  const bookingId = request.nextUrl.searchParams.get("booking");
  if (!bookingId || bookingId.length > 36) {
    return apiError("Pick a booking.", 400, "no_booking");
  }

  const actor: Actor = { id: member.user.id, role: member.profile.role };

  try {
    const booking = await getBooking(bookingId);
    if (!booking) return apiError("Booking not found.", 404, "not_found");

    if (!canReadPayment(actor, booking)) {
      return apiError("This booking is not yours.", 403, "forbidden");
    }

    return NextResponse.json({
      ok: true as const,
      payment: await getPaymentForBooking(booking.id),
    });
  } catch (error) {
    console.error("[api] payment read failed", error);
    return apiError("Could not load the payment.", 502, "payment_failed");
  }
}

/** PATCH /api/payments — a barber updates a payment on their own chair. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError(
      "This request came from an unexpected origin.",
      403,
      "bad_origin",
    );
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  const limit = rateLimit(`payment:${member.user.id}`, 30, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the payment details.", 400, "bad_payment");
  }

  const actor: Actor = { id: member.user.id, role: member.profile.role };

  try {
    const booking = await getBooking(parsed.data.booking);
    if (!booking) return apiError("Booking not found.", 404, "not_found");

    if (!(await canUpdatePayment(actor, booking))) {
      return apiError(
        "You can only update payments on your own chair.",
        403,
        "forbidden",
      );
    }

    const current = await ensurePayment(booking.id, booking.price);
    const payment = await updatePayment(current.id, {
      status: parsed.data.status,
      ...(parsed.data.method ? { method: parsed.data.method } : {}),
    });

    return NextResponse.json({ ok: true as const, payment });
  } catch (error) {
    console.error("[api] payment update failed", error);
    return apiError("Could not update the payment.", 502, "payment_failed");
  }
}
