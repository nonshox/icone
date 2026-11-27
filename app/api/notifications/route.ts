import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { get, str } from "@/lib/domain/crud";
import { listNotifications, markRead, unreadCount } from "@/lib/domain/notify";
import type { Notification } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z
  .object({
    id: z.string().trim().min(1).max(36).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || Boolean(value.id), {
    message: "Pick a notification or mark all as read.",
  });

/** The inbox uses the canonical `new`/`read` states from the domain. */
function clientNotification(item: Notification): Notification {
  return item;
}

/** GET /api/notifications?limit= — inbox preview and unread count. */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  if (guarded.actor.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 20;

  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(guarded.actor.userId, { limit }),
      unreadCount(guarded.actor.userId),
    ]);
    return apiOk({
      notifications: notifications.map(clientNotification),
      unread,
    });
  } catch (error) {
    console.error("[api] notifications failed", error);
    return apiError("Could not load your inbox.", 502, "notifications_failed");
  }
}

/** PATCH /api/notifications — mark one or every notification as read. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  if (guarded.actor.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const limit = rateLimit(`notifications:${guarded.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Pick a notification to update.", 400, "bad_notification");
  }

  try {
    const userId = guarded.actor.userId;
    let count: number;

    if (parsed.data.all) {
      count = await unreadCount(userId);
      await markRead(userId);
    } else {
      const id = parsed.data.id ?? "";
      const row = await get(TABLES.notifications, id);
      if (!row || str(row.user) !== userId) {
        return apiError("That notification was not found.", 404, "not_found");
      }
      await markRead(userId, id);
      count = 1;
    }

    return apiOk({ count });
  } catch (error) {
    console.error("[api] notification update failed", error);
    return apiError("Could not update your inbox.", 502, "notification_failed");
  }
}
