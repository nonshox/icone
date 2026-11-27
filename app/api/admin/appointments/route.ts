import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { transition, toBookingRow, toBookingRows } from "@/lib/domain/appointment";
import { audit } from "@/lib/domain/audit";
import { getBooking, normalizeStatus, toBooking } from "@/lib/domain/booking";
import { list } from "@/lib/domain/crud";
import { isDate } from "@/lib/domain/time";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Legacy status names are still present in older booking rows. */
const statusInput = z.enum([
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "done",
  "noshow",
  "booked",
  "accepted",
  "cancel",
]);

const patchSchema = z.object({
  id: z.string().trim().min(1, "Pick a booking.").max(36),
  status: statusInput,
});

/** GET /api/admin/appointments?status=&date=&barber= — every visit. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const date = params.get("date");
  if (date && !isDate(date)) {
    return apiError("Pick a date as YYYY-MM-DD.", 400, "bad_date");
  }

  const rawStatus = params.get("status") ?? undefined;
  const parsedStatus = statusInput.safeParse(rawStatus);
  if (rawStatus && !parsedStatus.success) {
    return apiError("Pick a valid status.", 400, "bad_status");
  }
  const wanted = parsedStatus.success ? normalizeStatus(parsedStatus.data) : undefined;

  const barber = params.get("barber") ?? undefined;

  try {
    const queries: string[] = [Query.orderDesc("$createdAt"), Query.limit(200)];
    if (date) queries.unshift(Query.equal("date", date));
    if (barber) queries.unshift(Query.equal("barber", barber));

    const rows = await list(TABLES.bookings, queries);
    const bookings = rows
      .map(toBooking)
      .filter((booking) => !wanted || booking.status === wanted);
    const enriched = await toBookingRows(bookings);

    return apiOk({
      bookings: enriched.map((booking) => ({
        ...booking,
        userName: booking.customerName,
      })),
    });
  } catch (error) {
    console.error("[admin] appointments list failed", error);
    return apiError("Could not load appointments.", 502, "appointments_failed");
  }
}

/** PATCH /api/admin/appointments — move a visit to a valid next status. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(
    `admin:appointments:${guard.actor.userId}`,
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
      parsed.error.issues[0]?.message ?? "Check the appointment details.",
      400,
      "invalid_appointment",
    );
  }

  try {
    const booking = await getBooking(parsed.data.id);
    if (!booking) return apiError("Appointment not found.", 404, "not_found");

    const result = await transition({
      booking,
      to: normalizeStatus(parsed.data.status),
      by: guard.actor.userId,
      kind: "admin",
    });
    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    await audit({
      actor: guard.actor.userId,
      action: "appointment.status",
      kind: "booking",
      target: booking.id,
      detail: result.booking.status,
    });

    const row = await toBookingRow(result.booking);
    return apiOk({ booking: { ...row, userName: row.customerName } });
  } catch (error) {
    console.error("[admin] appointment update failed", error);
    return apiError("Could not update the appointment.", 502, "appointment_failed");
  }
}
