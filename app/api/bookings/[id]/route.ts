import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { inBusiness, onBarber } from "@/lib/domain/access";
import {
  appointmentDetail,
  cancelByCustomer,
  toBookingRow,
  transition,
} from "@/lib/domain/appointment";
import { normalizeStatus } from "@/lib/domain/booking";
import {
  appointmentParams,
  businessAudience,
  notify,
  notifyMany,
} from "@/lib/domain/notify";
import { getBarber } from "@/lib/domain/professional";
import { reviewForBooking } from "@/lib/domain/review";
import { STATUSES } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin } from "@/lib/http";

/** Legacy status names are accepted so old deep links keep working. */
const bodySchema = z.object({
  status: z.enum([...STATUSES, "accepted", "booked", "cancel"] as const),
});

type Context = { params: Promise<{ id: string }> };

/** GET /api/bookings/:id — the owner or staff can read one booking. */
export async function GET(_request: NextRequest, context: Context) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const { id } = await context.params;

  try {
    const detail = await appointmentDetail(id);
    if (!detail) return apiError("Booking not found.", 404, "not_found");

    const staff = actor.profile.role === "admin" || actor.summary.staff;
    if (detail.booking.user !== actor.userId && !staff) {
      return apiError("This booking is not yours.", 403, "forbidden");
    }
    if (
      staff &&
      !onBarber(actor, detail.booking.barber) &&
      !inBusiness(actor, detail.booking.business)
    ) {
      return apiError("This booking is not on your chair.", 403, "forbidden");
    }

    const review = await reviewForBooking(id);
    return apiOk({
      booking: { ...detail.booking, reviewed: Boolean(review) },
      history: detail.history,
    });
  } catch (error) {
    console.error("[api] booking read failed", error);
    return apiError("Could not load the booking.", 502, "booking_failed");
  }
}

/**
 * PATCH /api/bookings/:id
 * Members may cancel their own upcoming booking. Staff may move a booking on
 * their own chair through its lifecycle.
 */
export async function PATCH(request: NextRequest, context: Context) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
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
  const target = normalizeStatus(parsed.data.status);

  try {
    const detail = await appointmentDetail(id);
    if (!detail) return apiError("Booking not found.", 404, "not_found");

    const booking = detail.booking;
    const owner = booking.user === actor.userId;
    const staff = actor.profile.role === "admin" || actor.summary.staff;

    if (!owner && !staff) {
      return apiError("This booking is not yours.", 403, "forbidden");
    }
    if (!staff && target !== "cancelled") {
      return apiError("You can only cancel your own booking.", 403, "forbidden");
    }
    if (
      staff &&
      !onBarber(actor, booking.barber) &&
      !inBusiness(actor, booking.business)
    ) {
      return apiError("This booking is not on your chair.", 403, "forbidden");
    }

    const result = staff
      ? await transition({ booking, to: target, by: actor.userId })
      : await cancelByCustomer(booking, actor.userId);

    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    const row = await toBookingRow(result.booking);
    const review = await reviewForBooking(id);
    const params = appointmentParams({
      date: row.date,
      start: row.start,
      barber: row.barberName,
    });
    const link = `/bookings/${row.id}`;

    const customerKey =
      target === "cancelled"
        ? "cancelled"
        : target === "confirmed"
          ? "confirmed"
          : target === "rejected"
            ? "rejected"
            : null;
    if (customerKey) {
      await notify({
        userId: booking.user,
        key: customerKey,
        params,
        link,
      }).catch((error) => console.error("[booking] status notice failed", error));
    }

    if (!staff && target === "cancelled") {
      const chair = await getBarber(booking.barber).catch(() => null);
      const staffIds = new Set<string>(chair?.user ? [chair.user] : []);
      if (chair?.business) {
        const audience = await businessAudience(chair.business, [
          "owner",
          "manager",
          "reception",
        ]).catch(() => []);
        audience.forEach((person) => staffIds.add(person));
      }
      if (staffIds.size > 0) {
        await notifyMany([...staffIds], {
          key: "cancelled",
          params,
          link,
        }).catch((error) =>
          console.error("[booking] cancel notice failed", error),
        );
      }
    }

    return apiOk({ booking: { ...row, reviewed: Boolean(review) } });
  } catch (error) {
    console.error("[api] booking update failed", error);
    return apiError("Could not update the booking.", 502, "update_failed");
  }
}
