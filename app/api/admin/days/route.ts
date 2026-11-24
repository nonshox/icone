import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  deleteDay,
  findBarber,
  listAllDays,
  putDay,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { isDate } from "@/lib/domain/time";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z
  .object({
    barber: z.string().trim().min(1, "Pick a barber.").max(36),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date as YYYY-MM-DD.")
      .refine(isDate, "Pick a real date."),
    open: z.boolean(),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    note: z.string().trim().max(64),
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

/** GET /api/admin/days — every date override. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({ ok: true as const, days: await listAllDays() });
  } catch (error) {
    console.error("[admin] days list failed", error);
    return apiError("Could not load date overrides.", 502, "days_failed");
  }
}

/**
 * POST /api/admin/days — add or replace the override for one chair and date.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change the catalogue.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:days:${member.user.id}`, 60, 10 * 60_000);
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
    if (!(await findBarber(parsed.data.barber))) {
      return apiError("That barber is not on the catalogue.", 404, "no_barber");
    }

    const day = await putDay(parsed.data);
    return NextResponse.json({ ok: true as const, day }, { status: 201 });
  } catch (error) {
    console.error("[admin] day save failed", error);
    return apiError("Could not save the date override.", 502, "days_failed");
  }
}

/** DELETE /api/admin/days?id=… — remove an override. Admin only. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change the catalogue.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:days:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick an override to remove."), 400, "invalid_id");
  }

  try {
    await deleteDay(parsed.data.id);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] day delete failed", error);
    return apiError("Could not remove the date override.", 502, "days_failed");
  }
}
