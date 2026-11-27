import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/api/guard";
import { appointmentDetail, toBookingRows } from "@/lib/domain/appointment";
import { TABLES } from "@/lib/appwrite/db";
import { toBooking } from "@/lib/domain/booking";
import { list } from "@/lib/domain/crud";
import { reviewForBooking } from "@/lib/domain/review";
import { apiError, apiOk } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

/** GET /api/admin/appointments/:id — booking, review and member history. */
export async function GET(_request: NextRequest, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  if (!id || id.length > 36) {
    return apiError("Pick an appointment.", 400, "invalid_id");
  }

  try {
    const detail = await appointmentDetail(id);
    if (!detail) return apiError("Appointment not found.", 404, "not_found");

    const booking = detail.booking;
    const customer = booking.user || booking.client;
    const customerKey = booking.user ? "user" : "client";

    const [review, historyRows] = await Promise.all([
      reviewForBooking(id),
      customer
        ? list(TABLES.bookings, [
            Query.equal(customerKey, customer),
            Query.orderDesc("$createdAt"),
            Query.limit(8),
          ])
        : Promise.resolve([]),
    ]);
    const history = (await toBookingRows(historyRows.map(toBooking))).map((row) => ({
      ...row,
      userName: row.customerName,
    }));

    return apiOk({
      detail: {
        booking: { ...booking, userName: booking.customerName },
        review,
        // Payments are no longer part of the product; there is nothing to show.
        payments: [],
        history,
      },
    });
  } catch (error) {
    console.error("[admin] appointment detail failed", error);
    return apiError("Could not load the appointment.", 502, "appointment_failed");
  }
}
