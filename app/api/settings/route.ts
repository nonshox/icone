import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getSettings, updateSettings } from "@/lib/domain/customer";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
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
    .refine((value) => value === "" || /^https?:\/\//.test(value), "Use an image link.")
    .optional(),
  prefs: z
    .object({
      bookings: z.boolean().optional(),
      reminders: z.boolean().optional(),
      offers: z.boolean().optional(),
    })
    .optional(),
});

/** GET /api/settings — profile plus notification preferences. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  try {
    return NextResponse.json({ ok: true as const, ...(await getSettings(member.user.id)) });
  } catch (error) {
    console.error("[api] settings failed", error);
    return apiError("Could not load your settings.", 502, "settings_failed");
  }
}

/** PATCH /api/settings — profile fields and notification preferences. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const limit = rateLimit(`settings:${member.user.id}`, 30, 10 * 60_000);
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
    const settings = await updateSettings(member.user.id, parsed.data);
    return NextResponse.json({ ok: true as const, ...settings });
  } catch (error) {
    console.error("[api] settings update failed", error);
    return apiError("Could not save your settings.", 502, "settings_failed");
  }
}
