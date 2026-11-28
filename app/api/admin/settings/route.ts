import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { getSettings, updateSettings } from "@/lib/domain/admin";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const patchSchema = z
  .object({
    applicationsOpen: z.boolean().optional(),
    autoVerify: z.boolean().optional(),
    notice: z.string().trim().max(512).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

/** GET /api/admin/settings — platform-wide switches. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    return apiOk({ settings: await getSettings() });
  } catch (error) {
    console.error("[admin] settings read failed", error);
    return apiError("Could not load settings.", 502, "settings_failed");
  }
}

/** PATCH /api/admin/settings — change one or more platform switches. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:settings:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the settings.",
      400,
      "invalid_settings",
    );
  }

  try {
    // Only the field names are audit-worthy; never log the submitted values.
    const settings = await updateSettings(parsed.data, guard.actor.userId);
    return apiOk({ settings });
  } catch (error) {
    console.error("[admin] settings update failed", error);
    return apiError("Could not save settings.", 502, "settings_failed");
  }
}
