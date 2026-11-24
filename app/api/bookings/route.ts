import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { TABLES } from "@/lib/appwrite/db";
import { book } from "@/lib/domain/book";
import { barberForUser, getMany } from "@/lib/domain/data";
import { createNotification } from "@/lib/domain/customer";
import { currentMember, isStaff } from "@/lib/domain/member";
import { ensurePayment } from "@/lib/domain/payments";
import { formatDate, isDate, label } from "@/lib/domain/time";
import { agenda, enrich, myBookings } from "@/lib/domain/views";
import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const bodySchema = z.object({
  barber: z.string().trim().min(1).max(36),
  service: z.string().trim().min(1).max(36),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  note: z.string().trim().max(200).default(""),
});

/**
 * GET /api/bookings — the member's bookings.
 * GET /api/bookings?date=YYYY-MM-DD — staff agenda for a day.
 */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to see your bookings.", 401, "signed_out");

  const params = request.nextUrl.searchParams;
  const date = params.get("date");

  try {
    if (date && isStaff(member.profile.role)) {
      if (!isDate(date)) {
        return apiError("Pick a valid date.", 400, "bad_date");
      }

      let barberId = params.get("barber") ?? undefined;

      if (member.profile.role === "barber") {
        const own = await barberForUser(member.user.id);
        if (!own) {
          return apiError(
            "Your account is not linked to a chair yet.",
            403,
            "no_chair",
          );
        }
        barberId = own.id;
      }

      return NextResponse.json({
        ok: true as const,
        bookings: await agenda(date, barberId),
      });
    }

    return NextResponse.json({
      ok: true as const,
      bookings: await myBookings(member.user.id),
    });
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

  const member = await currentMember();
  if (!member) return apiError("Sign in to book a chair.", 401, "signed_out");

  const limit = rateLimit(`book:${member.user.id}`, 12, 60 * 60_000);
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

  try {
    const result = await book({ ...parsed.data, user: member.user.id });

    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    // Open the shop payment row alongside the booking. Like the Telegram note
    // below, this is best effort: a confirmed chair is never rolled back.
    try {
      await ensurePayment(result.booking.id, result.booking.price);
    } catch (error) {
      console.error("[booking] payment row failed", error);
    }

    const [row] = await enrich([result.booking]);

    // In-app confirmation for the customer and a new-booking alert for staff.
    const body = `${row.serviceName} with ${row.barberName}, ${formatDate(row.date)} at ${label(row.start)}.`;
    await createNotification({
      user: member.user.id,
      title: result.booking.status === "pending" ? "Booking requested" : "Chair booked",
      body,
      kind: "booking",
    }).catch((error) => console.error("[booking] customer notice failed", error));

    const chairRows = await getMany(TABLES.barbers, [parsed.data.barber]).catch(() => []);
    const staffId = chairRows[0]?.user;
    if (typeof staffId === "string" && staffId) {
      await createNotification({
        user: staffId,
        title: "New booking request",
        body,
        kind: "booking",
      }).catch((error) => console.error("[booking] staff notice failed", error));
    }

    // Best-effort confirmation for Telegram members. A messaging failure must
    // never undo a confirmed chair — the reminder cron can still reach them.
    if (
      member.user.provider === "telegram" &&
      member.user.id.startsWith("tg_")
    ) {
      const chatId = Number(member.user.id.slice(3));
      if (Number.isSafeInteger(chatId) && chatId > 0) {
        const env = serverEnv();
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `Chair booked: ${row.serviceName} with ${row.barberName}, ${formatDate(row.date)} at ${label(row.start)}. See you there!`,
          `${env.NEXT_PUBLIC_APP_URL}/mini`,
        ).catch((error) => {
          console.error(
            "[booking] telegram confirmation failed",
            error instanceof Error ? error.message : "unknown",
          );
        });
      }
    }

    return NextResponse.json({ ok: true as const, booking: row }, { status: 201 });
  } catch (error) {
    console.error("[api] booking failed", error);
    return apiError("Could not save the booking.", 502, "booking_failed");
  }
}
