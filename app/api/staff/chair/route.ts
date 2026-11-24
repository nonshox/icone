import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { currentMember } from "@/lib/domain/member";
import { rateLimit } from "@/lib/rate-limit";
import {
  getMyChair,
  listMyDays,
  listMyHours,
  listMyUpcoming,
  StaffError,
  updateMyChair,
} from "@/lib/domain/staff";

const patchSchema = z.object({
  title: z.string().trim().max(64, "Keep the title under 64 characters."),
  bio: z.string().trim().max(512, "Keep the bio under 512 characters."),
  photo: z.string().trim().max(512, "Keep the photo link under 512 characters."),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function staffFailure(error: unknown, fallback: string, code: string) {
  if (error instanceof StaffError) {
    return apiError(error.message, error.status, error.code);
  }
  console.error("[staff] chair request failed", error);
  return apiError(fallback, 502, code);
}

/** GET /api/staff/chair — own chair, hours and days. ?upcoming=N adds the agenda. */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  try {
    const chair = await getMyChair(member.user.id);
    if (!chair) {
      return apiError("Your account is not linked to a chair yet.", 403, "no_chair");
    }

    const [hours, days] = await Promise.all([
      listMyHours(member.user.id),
      listMyDays(member.user.id),
    ]);

    const upcoming = request.nextUrl.searchParams.get("upcoming");
    if (upcoming) {
      const count = Number(upcoming);
      if (Number.isInteger(count) && count > 0 && count <= 60) {
        return apiOk({
          chair,
          hours,
          days,
          upcoming: await listMyUpcoming(member.user.id, count),
        });
      }
    }

    return apiOk({ chair, hours, days });
  } catch (error) {
    return staffFailure(error, "Could not load your chair.", "chair_failed");
  }
}

/** PATCH /api/staff/chair — update own profile fields. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  const limit = rateLimit(`staff:chair:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the chair details."), 400, "invalid_chair");
  }

  try {
    const chair = await updateMyChair(member.user.id, parsed.data);
    return apiOk({ chair });
  } catch (error) {
    return staffFailure(error, "Could not save your chair profile.", "chair_failed");
  }
}
