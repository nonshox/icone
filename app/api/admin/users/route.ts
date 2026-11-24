import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  linkBarberUser,
  listUsers,
  setUserRole,
  setUserStatus,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const userId = z.string().trim().min(1, "Pick a member.").max(36);

/** One operation per request: role, chair link, or account status. */
const patchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    return {
      ...(value as Record<string, unknown>),
      op: "role" in value ? "role" : "barber" in value ? "barber" : "status",
    };
  },
  z.discriminatedUnion("op", [
    z
      .object({
        op: z.literal("role"),
        userId,
        role: z.enum(["client", "barber", "admin"]),
      })
      .strict(),
    z
      .object({ op: z.literal("barber"), userId, barber: z.string().trim().max(36) })
      .strict(),
    z
      .object({ op: z.literal("status"), userId, active: z.boolean() })
      .strict(),
  ]),
);

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** GET /api/admin/users — accounts with their role and chair. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the team.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      users: await listUsers(),
    });
  } catch (error) {
    console.error("[admin] users list failed", error);
    return apiError("Could not load members.", 502, "users_failed");
  }
}

/** PATCH /api/admin/users — change a role or a linked chair. Admin only. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the team.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change the team.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:users:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the member details."), 400, "invalid_user");
  }

  try {
    if (parsed.data.op === "role") {
      await setUserRole(parsed.data.userId, parsed.data.role);
    } else if (parsed.data.op === "barber") {
      await linkBarberUser(parsed.data.barber, parsed.data.userId);
    } else {
      if (parsed.data.userId === member.user.id) {
        return apiError("You cannot change your own account status.", 400, "self_status");
      }
      await setUserStatus(parsed.data.userId, parsed.data.active);
    }
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] user update failed", error);
    return apiError("Could not update the member.", 502, "user_failed");
  }
}
