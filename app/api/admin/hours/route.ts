import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createHour,
  deleteHour,
  findBarber,
  listAllHours,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z
  .object({
    barber: z.string().trim().min(1, "Pick a barber.").max(36),
    day: z
      .number()
      .int("Pick a weekday.")
      .min(0, "Pick a weekday.")
      .max(6, "Pick a weekday."),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an opening hour to remove.").max(36),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** GET /api/admin/hours — weekly hours for every chair. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({ ok: true as const, hours: await listAllHours() });
  } catch (error) {
    console.error("[admin] hours list failed", error);
    return apiError("Could not load opening hours.", 502, "hours_failed");
  }
}

/** POST /api/admin/hours — add a weekly window. Admin only. */
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

  const limit = rateLimit(`admin:hours:${member.user.id}`, 60, 10 * 60_000);
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
    if (!(await findBarber(parsed.data.barber))) {
      return apiError("That barber is not on the catalogue.", 404, "no_barber");
    }

    const hour = await createHour(parsed.data);
    return NextResponse.json({ ok: true as const, hour }, { status: 201 });
  } catch (error) {
    console.error("[admin] hour create failed", error);
    return apiError("Could not save the opening hours.", 502, "hours_failed");
  }
}

/** DELETE /api/admin/hours?id=… — remove a weekly window. Admin only. */
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

  const limit = rateLimit(`admin:hours:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick an opening hour to remove."), 400, "invalid_id");
  }

  try {
    await deleteHour(parsed.data.id);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] hour delete failed", error);
    return apiError("Could not remove the opening hours.", 502, "hours_failed");
  }
}
