import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { barberAuth, businessFailure, firstIssue, readJson } from "@/app/api/barber/_auth";
import {
  getBusinessPrefs,
  requireChair,
  updateBusinessPrefs,
  updateBusinessProfile,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";

const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.");
const link = z.string().trim().max(512);
const text = z.string().trim().max(512);

const profileSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().max(64).optional(),
  bio: text.optional(),
  photo: link.optional(),
  active: z.boolean().optional(),
  shop: z.string().trim().max(64).optional(),
  address: z.string().trim().max(128).optional(),
  city: z.string().trim().max(64).optional(),
  years: z.number().int().min(0).max(80).optional(),
  skills: text.optional(),
  phone: phone.optional(),
  social: text.optional(),
  facilities: text.optional(),
  policy: text.optional(),
  cover: link.optional(),
  confirm: z.boolean().optional(),
  featured: z.boolean().optional(),
});

const prefsSchema = z.object({
  newBookings: z.boolean().optional(),
  cancellations: z.boolean().optional(),
  reviews: z.boolean().optional(),
  reminders: z.boolean().optional(),
});
const patchSchema = z.object({
  profile: profileSchema.optional(),
  prefs: prefsSchema.optional(),
});

/** GET /api/barber/settings — business profile and notification preferences. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const chair = await requireChair(auth.userId);
    const prefs = await getBusinessPrefs(auth.secret);
    return apiOk({ chair, prefs });
  } catch (error) {
    return businessFailure(error, "Could not load your settings.", "settings_failed");
  }
}

/** PATCH /api/barber/settings — save business details or notification prefs. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check your settings."), 400, "invalid_settings");
  }
  if (!parsed.data.profile && !parsed.data.prefs) {
    return apiError("Nothing to update.", 400, "invalid_settings");
  }

  try {
    const chair = parsed.data.profile
      ? await updateBusinessProfile(auth.userId, parsed.data.profile)
      : await requireChair(auth.userId);
    const prefs = parsed.data.prefs
      ? await updateBusinessPrefs(auth.secret, parsed.data.prefs)
      : await getBusinessPrefs(auth.secret);
    return apiOk({ chair, prefs });
  } catch (error) {
    return businessFailure(error, "Could not save your settings.", "settings_failed");
  }
}
