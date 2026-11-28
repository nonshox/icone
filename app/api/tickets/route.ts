import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { createTicket } from "@/lib/domain/admin";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  topic: z.string().trim().min(1, "Give the request a topic.").max(64),
  body: z.string().trim().min(1, "Tell us what you need.").max(1024),
});

/** POST /api/tickets — a signed-in member opens a support request. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`tickets:${guard.actor.userId}`, 5, 10 * 60_000);
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
      parsed.error.issues[0]?.message ?? "Check the request details.",
      400,
      "invalid_ticket",
    );
  }

  try {
    const ticket = await createTicket({
      user: guard.actor.userId,
      topic: parsed.data.topic,
      body: parsed.data.body,
    });
    return apiOk({ ticket });
  } catch (error) {
    console.error("[api] ticket create failed", error);
    return apiError("Could not send the request.", 502, "ticket_failed");
  }
}
