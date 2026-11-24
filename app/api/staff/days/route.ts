import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { isDate } from "@/lib/domain/time";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { currentMember } from "@/lib/domain/member";
import { rateLimit } from "@/lib/rate-limit";
import { deleteMyDay, saveMyDay, StaffError } from "@/lib/domain/staff";

const createSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date as YYYY-MM-DD.")
      .refine(isDate, "Pick a real date."),
    open: z.boolean(),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    note: z.string().trim().max(64, "Keep the note under 64 characters."),
  })
  .refine((value) => !value.open || value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an override to remove.").max(36),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function staffFailure(error: unknown, fallback: string, code: string) {
  if (error instanceof StaffError) {
    return apiError(error.message, error.status, error.code);
  }
  console.error("[staff] days request failed", error);
  return apiError(fallback, 502, code);
}

/** POST /api/staff/days — add or replace one override on own chair. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  const limit = rateLimit(`staff:days:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the date override."), 400, "invalid_day");
  }

  try {
    const day = await saveMyDay(member.user.id, parsed.data);
    return apiOk({ day });
  } catch (error) {
    return staffFailure(error, "Could not save the date override.", "days_failed");
  }
}

/** DELETE /api/staff/days?id=… — remove an override from own chair. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage your chair.", 401, "signed_out");
  if (member.profile.role !== "barber") {
    return apiError("Barber access only.", 403, "forbidden");
  }

  const limit = rateLimit(`staff:days:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick an override to remove."), 400, "invalid_id");
  }

  try {
    await deleteMyDay(member.user.id, parsed.data.id);
    return apiOk();
  } catch (error) {
    return staffFailure(error, "Could not remove the date override.", "days_failed");
  }
}
