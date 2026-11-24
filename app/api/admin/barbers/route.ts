import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createBarber, listAllBarbers, setBarberActive } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the barber a name.").max(64),
  title: z.string().trim().max(64),
  bio: z.string().trim().max(512),
});

const patchSchema = z.object({
  id: z.string().trim().min(1, "Pick a barber.").max(36),
  active: z.boolean(),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** GET /api/admin/barbers — every chair, including inactive ones. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      barbers: await listAllBarbers(),
    });
  } catch (error) {
    console.error("[admin] barbers list failed", error);
    return apiError("Could not load barbers.", 502, "barbers_failed");
  }
}

/** POST /api/admin/barbers — add a chair. Admin only. */
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

  const limit = rateLimit(`admin:barbers:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the barber details."), 400, "invalid_barber");
  }

  try {
    const barber = await createBarber(parsed.data);
    return NextResponse.json({ ok: true as const, barber }, { status: 201 });
  } catch (error) {
    console.error("[admin] barber create failed", error);
    return apiError("Could not add the barber.", 502, "barber_failed");
  }
}

/** PATCH /api/admin/barbers — take a chair online or offline. Admin only. */
export async function PATCH(request: NextRequest) {
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

  const limit = rateLimit(`admin:barbers:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the barber details."), 400, "invalid_barber");
  }

  try {
    const barber = await setBarberActive(parsed.data.id, parsed.data.active);
    return NextResponse.json({ ok: true as const, barber });
  } catch (error) {
    console.error("[admin] barber update failed", error);
    return apiError("Could not update the barber.", 502, "barber_failed");
  }
}
