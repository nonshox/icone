import "server-only";

import { Users } from "node-appwrite";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/appwrite/server";
import { setPrefs, updateProfile } from "@/lib/domain/account";
import type { NotificationPrefs, Profile } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.")
    .optional(),
  avatar: z
    .string()
    .trim()
    .max(512)
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\//.test(value) ||
        /^[a-z0-9_-]+\.[a-z0-9]+$/i.test(value),
      "Use an image link or an uploaded image id.",
    )
    .optional(),
  prefs: z
    .object({
      booking: z.boolean().optional(),
      reminder: z.boolean().optional(),
      waitlist: z.boolean().optional(),
      business: z.boolean().optional(),
      marketing: z.boolean().optional(),
      // Legacy aliases kept so old clients can still save.
      bookings: z.boolean().optional(),
      reminders: z.boolean().optional(),
      offers: z.boolean().optional(),
    })
    .optional(),
});

/** Preferences use the same canonical keys in the UI and the domain. */
function visiblePrefs(profile: Profile): NotificationPrefs {
  return profile.prefs;
}

/** GET /api/settings — profile plus notification preferences. */
export async function GET() {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  
  return apiOk({
    profile: guarded.actor.profile,
    prefs: visiblePrefs(guarded.actor.profile),
  });
}

/** PATCH /api/settings — profile fields and notification preferences. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  
  const limit = rateLimit(`settings:${guarded.actor.userId}`, 30, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your details.";
    return apiError(message, 400, "bad_settings");
  }

  try {
    const userId = guarded.actor.userId;
    const fields = parsed.data;
    const patch = {
      ...(typeof fields.name === "string" ? { name: fields.name } : {}),
      ...(typeof fields.phone === "string" ? { phone: fields.phone } : {}),
      ...(typeof fields.avatar === "string" ? { avatar: fields.avatar } : {}),
    };

    let profile = guarded.actor.profile;
    if (Object.keys(patch).length > 0) {
      profile = await updateProfile(userId, patch);
    }

    if (fields.prefs) {
      const current: NotificationPrefs = profile.prefs;
      const input = fields.prefs;
      const next: NotificationPrefs = {
        ...current,
        booking: input.booking ?? input.bookings ?? current.booking,
        reminder: input.reminder ?? input.reminders ?? current.reminder,
        waitlist: input.waitlist ?? current.waitlist,
        business: input.business ?? current.business,
        marketing: input.marketing ?? input.offers ?? current.marketing,
      };
      profile = await setPrefs(userId, next);
    }

    if (fields.name && fields.name !== guarded.actor.profile.name) {
      await new Users(createAdminClient())
        .updateName({ userId, name: fields.name })
        .catch((error) => console.error("[api] could not sync auth name", error));
    }

    return apiOk({ profile, prefs: visiblePrefs(profile) });
  } catch (error) {
    console.error("[api] settings update failed", error);
    return apiError("Could not save your settings.", 502, "settings_failed");
  }
}

