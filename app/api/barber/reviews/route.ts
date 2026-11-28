import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireCap } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { onBarber } from "@/lib/domain/access";
import { get } from "@/lib/domain/crud";
import { replyToReview, toReview } from "@/lib/domain/review";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  id: z.string().trim().min(1, "Pick a review.").max(36),
  reply: z.string().trim().min(1, "Write a reply.").max(512),
});

async function answer(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check your reply.",
      400,
      "invalid_reply",
    );
  }

  // The barber is only known after the review is loaded, so the capability
  // check is scoped from the row itself rather than from the request body.
  let review;
  try {
    const row = await get(TABLES.reviews, parsed.data.id);
    if (!row) return apiError("Review not found.", 404, "not_found");
    review = toReview(row);
  } catch (error) {
    console.error("[barber] review lookup failed", error);
    return apiError("Could not load the review.", 502, "review_failed");
  }

  // The business scope lets shop staff answer reviews for chairs that are not
  // explicitly linked to their membership row.
  const guard = await requireCap("settings.profile", {
    barber: review.barber,
    business: review.business,
  });
  if (!guard.ok) return guard.response;

  const actor = guard.actor;
  const inBusiness = Boolean(
    review.business &&
      actor.memberships.some((member) => member.business === review.business),
  );
  if (!onBarber(actor, review.barber) && !inBusiness) {
    return apiError("You cannot reply to this review.", 403, "forbidden");
  }

  const limit = await rateLimit(`reviews:reply:${actor.userId}`, 30, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const updated = await replyToReview(review.id, parsed.data.reply);
    return apiOk({ review: updated });
  } catch (error) {
    console.error("[barber] review reply failed", error);
    return apiError("Could not save your reply.", 502, "review_failed");
  }
}

/** POST /api/barber/reviews — publish a public reply to a review. */
export async function POST(request: NextRequest) {
  return answer(request);
}

/** PATCH /api/barber/reviews — same operation for PATCH-based clients. */
export async function PATCH(request: NextRequest) {
  return answer(request);
}
