import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  barberAuth,
  businessFailure,
  firstIssue,
  readJson,
} from "@/app/api/barber/_auth";
import {
  listBusinessNotifications,
  markAllBusinessNotifications,
  markBusinessNotification,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";

const patchSchema = z
  .object({
    id: z.string().trim().min(1).max(36).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => (value.all === true) !== Boolean(value.id), {
    message: "Pick one notification or mark all as read.",
  });

/** GET /api/barber/notifications — this barber's own inbox. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    return apiOk({ notifications: await listBusinessNotifications(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your inbox.", "inbox_failed");
  }
}

/** PATCH /api/barber/notifications — mark one, or all, as read. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick a notification."), 400, "invalid_notification");
  }

  try {
    if (parsed.data.all) {
      const changed = await markAllBusinessNotifications(auth.userId);
      return apiOk({ changed });
    }
    const notification = await markBusinessNotification(auth.userId, parsed.data.id!);
    return apiOk({ notification });
  } catch (error) {
    return businessFailure(error, "Could not update your inbox.", "inbox_failed");
  }
}
