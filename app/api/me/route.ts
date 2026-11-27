import "server-only";

import { Users } from "node-appwrite";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/appwrite/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateProfile } from "@/lib/domain/account";
import { apiError, apiOk, isSameOrigin } from "@/lib/http";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.")
    .optional(),
});

/** GET /api/me — the signed-in profile. */
export async function GET() {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const user = await getCurrentUser();
  return apiOk({ profile: guarded.actor.profile, user });
}

/** PATCH /api/me — update display name and phone. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check your name and phone.", 400, "invalid_profile");
  }

  try {
    const profile = await updateProfile(guarded.actor.userId, parsed.data);

    if (parsed.data.name && parsed.data.name !== guarded.actor.profile.name) {
      await new Users(createAdminClient())
        .updateName({ userId: guarded.actor.userId, name: parsed.data.name })
        .catch((error) => {
          console.error("[api] could not sync auth name", error);
        });
    }

    return apiOk({ profile });
  } catch (error) {
    console.error("[api] profile update failed", error);
    return apiError("Could not save your profile.", 502, "profile_failed");
  }
}
