import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { createReport } from "@/lib/domain/admin";
import type { Report } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  kind: z.enum(["user", "barber", "business", "booking", "review", "other"]),
  target: z.string().trim().min(1, "Pick what you are reporting.").max(36),
  note: z.string().trim().min(1, "Tell us what happened.").max(512),
});

/** POST /api/reports — a signed-in member reports a user, chair or booking. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`reports:${guard.actor.userId}`, 5, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the report details.",
      400,
      "invalid_report",
    );
  }

  try {
    const report = await createReport({
      reporter: guard.actor.userId,
      // The column predates the "barber" and "other" labels; toReport() casts
      // the stored string back on read, so both round-trip unchanged.
      kind: parsed.data.kind as Report["kind"],
      target: parsed.data.target,
      note: parsed.data.note,
    });
    return apiOk({ report });
  } catch (error) {
    console.error("[api] report create failed", error);
    return apiError("Could not send the report.", 502, "report_failed");
  }
}
