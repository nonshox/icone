import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { currentMember } from "@/lib/domain/member";
import { rateLimit } from "@/lib/rate-limit";
import { createMyHour, deleteMyHour, StaffError } from "@/lib/domain/staff";

const createSchema = z
  .object({
    day: z.number().int().min(0, "Pick a weekday.").max(6, "Pick a weekday."),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick opening hours to remove.").max(36),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function staffFailure(error: unknown, fallback: string, code: string) {
  if (error instanceof StaffError) {
    return apiError(error.message, error.status, error.code);
  }
  console.error("[staff] hours request failed", error);
  return apiError(fallback, 502, code);
}

/** POST /api/staff/hours — add a weekly window to own chair. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  const limit = rateLimit(`staff:hours:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the opening hours."), 400, "invalid_hours");
  }

  try {
    const hour = await createMyHour(member.user.id, parsed.data);
    return NextResponse.json({ ok: true as const, hour }, { status: 201 });
  } catch (error) {
    return staffFailure(error, "Could not save the opening hours.", "hours_failed");
  }
}

/** DELETE /api/staff/hours?id=… — remove a weekly window from own chair. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  const limit = rateLimit(`staff:hours:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick opening hours to remove."), 400, "invalid_id");
  }

  try {
    await deleteMyHour(member.user.id, parsed.data.id);
    return apiOk();
  } catch (error) {
    return staffFailure(error, "Could not remove the opening hours.", "hours_failed");
  }
}
