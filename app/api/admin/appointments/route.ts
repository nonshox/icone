import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  findAdminBooking,
  listAdminBookings,
  setAdminBookingStatus,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { isDate } from "@/lib/domain/time";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const patchSchema = z.object({
  id: z.string().trim().min(1, "Pick a booking.").max(36),
  status: z.enum([
    "pending",
    "accepted",
    "booked",
    "done",
    "cancel",
    "noshow",
    "rejected",
  ]),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/**
 * GET /api/admin/appointments?status=&date=&barber=
 * Every visit on the platform, with filters. Staff only.
 */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage appointments.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  const params = request.nextUrl.searchParams;
  const date = params.get("date");
  if (date && !isDate(date)) {
    return apiError("Pick a date as YYYY-MM-DD.", 400, "bad_date");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      bookings: await listAdminBookings({
        status: params.get("status") ?? undefined,
        date: date ?? undefined,
        barber: params.get("barber") ?? undefined,
      }),
    });
  } catch (error) {
    console.error("[admin] appointments list failed", error);
    return apiError("Could not load appointments.", 502, "appointments_failed");
  }
}

/** PATCH /api/admin/appointments — set any visit status. Admin only. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage appointments.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change appointment status.", 403, "forbidden");
  }

  const limit = rateLimit(
    `admin:appointments:${member.user.id}`,
    60,
    10 * 60_000,
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the appointment details."),
      400,
      "invalid_appointment",
    );
  }

  try {
    if (!(await findAdminBooking(parsed.data.id))) {
      return apiError("Appointment not found.", 404, "not_found");
    }
    const booking = await setAdminBookingStatus(parsed.data.id, parsed.data.status);
    return NextResponse.json({ ok: true as const, booking });
  } catch (error) {
    console.error("[admin] appointment update failed", error);
    return apiError("Could not update the appointment.", 502, "appointment_failed");
  }
}
