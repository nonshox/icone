import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { createReview, ratingSummary, reviewsWithAuthors } from "@/lib/domain/review";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  booking: z.string().trim().min(1).max(36),
  rate: z.number().int().min(1).max(5),
  note: z.string().trim().max(400).default(""),
});

/** GET /api/reviews?barber= — public reviews for one chair. */
export async function GET(request: NextRequest) {
  const barber = request.nextUrl.searchParams.get("barber");
  if (!barber) return apiError("Pick a barber.", 400, "no_barber");

  try {
    const reviews = await reviewsWithAuthors(barber);
    return apiOk({
      reviews: reviews.map((review) => ({
        ...review,
        userName: review.userName || "Member",
      })),
    });
  } catch (error) {
    console.error("[api] reviews failed", error);
    return apiError("Could not load reviews.", 502, "reviews_failed");
  }
}

/** POST /api/reviews — rate a finished visit, once. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const limit = await rateLimit(`review:${guarded.actor.userId}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Give a rating from 1 to 5.", 400, "bad_review");
  }

  try {
    const result = await createReview({
      user: guarded.actor.userId,
      bookingId: parsed.data.booking,
      rate: parsed.data.rate,
      note: parsed.data.note,
    });

    if (!result.ok) {
      return apiError(result.message, result.status, result.code);
    }

    const rating = (await ratingSummary(result.review.barber)).average;
    return apiOk({ review: result.review, rating });
  } catch (error) {
    console.error("[api] review failed", error);
    return apiError("Could not save the review.", 502, "review_failed");
  }
}
