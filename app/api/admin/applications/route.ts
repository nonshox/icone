import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { decideApplication, listApplications } from "@/lib/domain/applications";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  id: z.string().trim().min(1).max(36),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(256).default(""),
});

async function requireAdmin() {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "admin") {
    return apiError("Admin access only.", 403, "forbidden");
  }
  return null;
}

/** GET /api/admin/applications — review queue. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json({
      ok: true as const,
      applications: await listApplications(),
    });
  } catch (error) {
    console.error("[applications] admin list failed — check the applications collection in db:setup", error);
    return apiError(
      "Could not load applications. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}

/** PATCH /api/admin/applications — approve or reject. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const denied = await requireAdmin();
  if (denied) return denied;

  const member = await currentMember();
  const limit = rateLimit(`applications:admin:${member?.user.id ?? "anon"}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the decision.", 400, "invalid_decision");
  }

  try {
    const application = await decideApplication(
      parsed.data.id,
      parsed.data.decision,
      parsed.data.note,
    );
    return NextResponse.json({ ok: true as const, application });
  } catch (error) {
    console.error("[applications] decision failed — check the barbers and users collections in db:setup", error);
    return apiError(
      "Could not review the application. Please try again shortly.",
      502,
      "decision_failed",
    );
  }
}
