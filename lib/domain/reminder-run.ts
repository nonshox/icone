import "server-only";

import { Query } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { getBooking, reconcileBookings } from "@/lib/domain/booking";
import { ensureReminder, listPending, markSent } from "@/lib/domain/reminders";
import { notify } from "@/lib/domain/notify";
import { getBarbers } from "@/lib/domain/professional";
import { addDays, label, today } from "@/lib/domain/time";

/** Remind this many minutes before the appointment starts. */
const LEAD_MINUTES = 120;

export type ReminderCounts = {
  created: number;
  sent: number;
  skipped: number;
  failed: number;
  reconciled: number;
};

/**
 * Plan tomorrow's appointments, then deliver everything still pending.
 *
 * A reminder's `date` is the appointment date. The cron runs once a day, so
 * tying delivery to a minute-of-day window would silently drop appointments
 * that start after the run. Instead every queued row due on or before
 * tomorrow is delivered in this run, and the row closes immediately so a
 * repeated run can never send the same reminder twice.
 */
export async function runReminders(): Promise<ReminderCounts> {
  const date = today();
  const tomorrow = addDays(date, 1);
  const counts: ReminderCounts = {
    created: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    reconciled: 0,
  };

  const upcoming = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: TABLES.bookings,
    queries: [
      Query.equal("date", tomorrow),
      Query.equal("status", ["confirmed", "pending"]),
      Query.limit(100),
    ],
  });

  for (const row of upcoming.documents) {
    const user = typeof row.user === "string" ? row.user : "";
    if (!user.startsWith("tg_")) {
      counts.skipped += 1;
      continue;
    }

    const start = typeof row.start === "number" ? row.start : 0;
    const created = await ensureReminder({
      user,
      booking: row.$id,
      date: tomorrow,
      at: Math.max(0, start - LEAD_MINUTES),
    });
    if (created) counts.created += 1;
  }

  const due = await listPending(tomorrow);

  for (const reminder of due) {
    const booking = await getBooking(reminder.booking);

    if (!booking || (booking.status !== "confirmed" && booking.status !== "pending")) {
      // Cancelled or deleted since the reminder was queued — close it out.
      await markSent(reminder.id);
      counts.skipped += 1;
      continue;
    }

    const chatId = Number(reminder.user.slice(3));
    if (!Number.isSafeInteger(chatId) || chatId <= 0) {
      await markSent(reminder.id);
      counts.skipped += 1;
      continue;
    }

    try {
      // `notify` writes the localized in-app row before it attempts Telegram.
      // Close the reminder immediately afterwards: a transport failure must
      // never produce a second inbox row or a second Telegram message on the
      // next run. The preference is respected because reminders are not forced.
      const barbers = await getBarbers([booking.barber]);
      const delivered = await notify({
        userId: reminder.user,
        key: "reminder",
        params: {
          date: booking.date,
          time: label(booking.start),
          barber: barbers.get(booking.barber)?.name ?? "",
        },
        link: `/bookings/${booking.id}`,
      });
      await markSent(reminder.id);
      if (delivered) counts.sent += 1;
      else counts.failed += 1;
    } catch (error) {
      await markSent(reminder.id).catch(() => undefined);
      counts.failed += 1;
      console.error(
        "[reminders] send failed",
        reminder.id,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  // Requests that can now be satisfied are announced in the same run.
  counts.reconciled = await reconcileBookings();

  const { matchWaitlist, expireWaits } = await import("@/lib/domain/waitlist");
  await expireWaits();
  await matchWaitlist();

  return counts;
}
