import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { runReminders, type ReminderCounts } from "@/lib/domain/reminder-run";
import { serverEnv } from "@/lib/env";
import { apiError, apiOk } from "@/lib/http";

const COOLDOWN_MS = 60_000;
let lastRunAt = 0;

const EMPTY: ReminderCounts = { created: 0, sent: 0, skipped: 0, failed: 0 };

function matches(provided: string | null): boolean {
  if (!provided) return false;

  const actual = Buffer.from(provided, "utf8");
  const expected = Buffer.from(serverEnv().TELEGRAM_WEBHOOK_SECRET, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isAuthorized(request: NextRequest): boolean {
  const direct = request.headers.get("x-cron-secret");
  if (matches(direct)) return true;

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const bearer = request.headers.get("authorization");
  return matches(bearer?.startsWith("Bearer ") ? bearer.slice(7) : null);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return apiError("Unauthorized.", 401, "unauthorized");
  }

  const now = Date.now();
  if (now - lastRunAt < COOLDOWN_MS) {
    return apiOk({ counts: EMPTY, cooldown: true });
  }
  lastRunAt = now;

  try {
    return apiOk({ counts: await runReminders() });
  } catch (error) {
    console.error("[cron] reminders failed", error);
    return apiError("Could not run reminders.", 502, "reminders_failed");
  }
}

export const GET = handle;
export const POST = handle;
