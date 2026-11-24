import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  getMyApplication,
  submitApplication,
} from "@/lib/domain/applications";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(64),
  shop: z.string().trim().max(64),
  city: z.string().trim().max(64),
  address: z.string().trim().max(128),
  phone: z.string().trim().max(32).regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only."),
  bio: z.string().trim().max(512),
});

/** GET /api/applications — the caller's application status. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  try {
    return NextResponse.json({
      ok: true as const,
      application: await getMyApplication(member.user.id),
    });
  } catch (error) {
    console.error("[applications] read failed — check the applications collection in db:setup", error);
    return apiError(
      "Applications are unavailable right now. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}

/** POST /api/applications — apply to run a chair. Clients only. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("Only client accounts can apply.", 403, "forbidden");
  }

  const limit = rateLimit(`applications:${member.user.id}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check your details.",
      400,
      "invalid_application",
    );
  }

  try {
    const application = await submitApplication(member.user.id, parsed.data);
    return NextResponse.json({ ok: true as const, application }, { status: 201 });
  } catch (error) {
    console.error("[applications] submit failed — check the applications collection in db:setup", error);
    return apiError(
      "Could not send your application. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}
