import "server-only";

import { Query } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { getBooking } from "@/lib/domain/data";
import { ensureReminder, listDue, markFailed, markSent } from "@/lib/domain/reminders";
import { addDays, label, shopClock, today } from "@/lib/domain/time";
import { serverEnv } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const LEAD_MINUTES = 120;
const MAX_TRIES = 3;

export type ReminderCounts = {
  created: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Plan tomorrow's bookings, then deliver whatever is due today.
 *
 * The reminder's `date` is the day it should fire (today), while the bookings
 * we scan are tomorrow's — that is why the copy can say "tomorrow". Keeping
 * the row in `pending` until Telegram accepts it makes every later run a
 * retry; `markSent` plus the unique `once` index stop a second delivery.
 */
export async function runReminders(): Promise<ReminderCounts> {
  const env = serverEnv();
  const date = today();
  const tomorrow = addDays(date, 1);
  const counts: ReminderCounts = { created: 0, sent: 0, skipped: 0, failed: 0 };

  const bookings = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: TABLES.bookings,
    queries: [
      Query.equal("date", tomorrow),
      Query.equal("status", "booked"),
      Query.limit(100),
    ],
  });

  for (const row of bookings.documents) {
    const user = typeof row.user === "string" ? row.user : "";
    if (!user.startsWith("tg_")) {
      counts.skipped += 1;
      continue;
    }

    const start = typeof row.start === "number" ? row.start : 0;
    const at = Math.max(0, start - LEAD_MINUTES);

    const created = await ensureReminder({
      user,
      booking: row.$id,
      date,
      at,
    });
    if (created) counts.created += 1;
  }

  const { minutes } = shopClock();
  const due = await listDue(date, 0, minutes);

  for (const reminder of due) {
    const booking = await getBooking(reminder.booking);

    if (!booking || booking.status !== "booked") {
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
      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        `Your chair at icone is tomorrow at ${label(booking.start)}. See you there!`,
        env.NEXT_PUBLIC_APP_URL,
      );
      await markSent(reminder.id);
      counts.sent += 1;
    } catch (error) {
      const closed = await markFailed(reminder.id, reminder.tries, MAX_TRIES);
      if (closed) counts.skipped += 1;
      else counts.failed += 1;
      console.error(
        "[reminders] send failed",
        reminder.id,
        `try ${reminder.tries + 1}/${MAX_TRIES}`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return counts;
}
