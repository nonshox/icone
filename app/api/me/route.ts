import "server-only";

import { Users } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/appwrite/server";
import { currentMember } from "@/lib/domain/member";
import { updateProfile } from "@/lib/domain/data";
import { apiError, isSameOrigin } from "@/lib/http";

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
  const member = await currentMember();
  if (!member) return apiError("Signed out.", 401, "signed_out");

  return NextResponse.json({
    ok: true as const,
    profile: member.profile,
    user: member.user,
  });
}

/** PATCH /api/me — update display name and phone. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Signed out.", 401, "signed_out");

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
    const profile = await updateProfile(member.user.id, parsed.data);

    if (parsed.data.name && parsed.data.name !== member.user.name) {
      await new Users(createAdminClient())
        .updateName({ userId: member.user.id, name: parsed.data.name })
        .catch((error) => {
          console.error("[api] could not sync auth name", error);
        });
    }

    return NextResponse.json({ ok: true as const, profile });
  } catch (error) {
    console.error("[api] profile update failed", error);
    return apiError("Could not save your profile.", 502, "profile_failed");
  }
}
