import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAnnouncement, listAnnouncements } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the announcement a title.").max(96),
  body: z.string().trim().min(1, "Write a message.").max(512),
  audience: z.enum(["all", "client", "barber", "admin"]),
});

/** GET /api/admin/announcements — recent broadcasts. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to view announcements.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      announcements: await listAnnouncements(),
    });
  } catch (error) {
    console.error("[admin] announcements list failed", error);
    return apiError("Could not load announcements.", 502, "announcements_failed");
  }
}

/**
 * POST /api/admin/announcements — one inbox notification per recipient.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to broadcast.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can broadcast announcements.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:announcements:${member.user.id}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the announcement.",
      400,
      "invalid_announcement",
    );
  }

  try {
    const result = await createAnnouncement(parsed.data);
    return NextResponse.json(
      { ok: true as const, ...result },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin] announcement broadcast failed", error);
    return apiError("Could not send the announcement.", 502, "announcement_failed");
  }
}
