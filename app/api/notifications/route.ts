import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationInbox,
} from "@/lib/domain/customer";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z
  .object({
    id: z.string().trim().min(1).max(36).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || Boolean(value.id), {
    message: "Pick a notification or mark all as read.",
  });

/** GET /api/notifications?limit= — inbox preview and unread count. */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 20;

  try {
    const inbox = await notificationInbox(member.user.id, limit);
    return NextResponse.json({ ok: true as const, ...inbox });
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

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const limit = rateLimit(`notifications:${member.user.id}`, 60, 10 * 60_000);
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
    const count = parsed.data.all
      ? await markAllNotificationsRead(member.user.id)
      : (await markNotificationRead(member.user.id, parsed.data.id ?? ""))
        ? 1
        : 0;

    if (count === 0 && !parsed.data.all) {
      return apiError("That notification was not found.", 404, "not_found");
    }

    return NextResponse.json({ ok: true as const, count });
  } catch (error) {
    console.error("[api] notification update failed", error);
    return apiError("Could not update your inbox.", 502, "notification_failed");
  }
}
