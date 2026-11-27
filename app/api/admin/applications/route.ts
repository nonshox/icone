import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { decideApplication, listApplications } from "@/lib/domain/application";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const stateSchema = z.enum([
  "draft",
  "submitted",
  "review",
  "info",
  "approved",
  "rejected",
  "suspended",
]);

const querySchema = z.object({
  state: stateSchema.optional(),
  model: z.enum(["a", "b"]).optional(),
  q: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** Old clients sent the past-tense names; the domain uses imperative ones. */
const decisionSchema = z.object({
  id: z.string().trim().min(1).max(36),
  decision: z.enum([
    "approve",
    "reject",
    "request",
    "suspend",
    "approved",
    "rejected",
  ]),
  note: z.string().trim().max(512).default(""),
});

/** GET /api/admin/applications — the review queue. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    state: params.get("state") ?? undefined,
    model: params.get("model") ?? undefined,
    q: params.get("q") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("Check the queue filters.", 400, "invalid_filter");
  }

  try {
    return apiOk({ applications: await listApplications(parsed.data) });
  } catch (error) {
    console.error("[applications] admin list failed", error);
    return apiError(
      "Could not load applications. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}

/** PATCH /api/admin/applications — approve, reject, request info or suspend. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(
    `applications:admin:${guard.actor.userId}`,
    60,
    10 * 60_000,
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the decision.", 400, "invalid_decision");
  }

  const decision =
    parsed.data.decision === "approved"
      ? "approve"
      : parsed.data.decision === "rejected"
        ? "reject"
        : parsed.data.decision;

  try {
    const result = await decideApplication({
      id: parsed.data.id,
      decision,
      by: guard.actor.userId,
      note: parsed.data.note,
    });
    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }
    return apiOk({ application: result.application });
  } catch (error) {
    console.error("[applications] decision failed", error);
    return apiError(
      "Could not review the application. Please try again shortly.",
      502,
      "decision_failed",
    );
  }
}
