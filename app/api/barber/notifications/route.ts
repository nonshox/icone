import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  readJson,
  requireWorkspace,
  writeDenied,
} from "@/app/api/barber/_auth";
import { listNotifications, markRead, unreadCount } from "@/lib/domain/notify";
import { apiError, apiOk } from "@/lib/http";

const patchSchema = z
  .object({
    id: z.string().trim().min(1).max(36).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => (value.all === true) !== Boolean(value.id), {
    message: "Pick one notification or mark all as read.",
  });

/** GET /api/barber/notifications — this account's own inbox. */
export async function GET() {
  const guarded = await requireWorkspace("settings.profile");
  if (!guarded.ok) return guarded.response;

  try {
    return apiOk({
      notifications: await listNotifications(guarded.actor.userId),
    });
  } catch (error) {
    return businessFailure(error, "Could not load your inbox.", "inbox_failed");
  }
}

/** PATCH /api/barber/notifications — mark one, or all, as read. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireWorkspace("settings.profile");
  if (!guarded.ok) return guarded.response;

  const denied = writeDenied(
    request,
    `barber:notifications:${guarded.actor.userId}`,
    60,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Pick a notification."),
      400,
      "invalid_notification",
    );
  }

  try {
    const userId = guarded.actor.userId;
    if (parsed.data.all) {
      const changed = await unreadCount(userId);
      await markRead(userId);
      return apiOk({ changed });
    }

    const id = parsed.data.id!;
    const rows = await listNotifications(userId, { limit: 100 });
    const found = rows.find((row) => row.id === id);
    if (!found) {
      return apiError("That notification no longer exists.", 404, "not_found");
    }
    // `markRead` updates by id, so confirm ownership here first.
    await markRead(userId, id);
    return apiOk({ notification: { ...found, state: "read" as const } });
  } catch (error) {
    return businessFailure(error, "Could not update your inbox.", "inbox_failed");
  }
}
