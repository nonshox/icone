import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { TABLES } from "@/lib/appwrite/db";
import {
  createReview,
  getBooking,
  getMany,
  getReviewByBooking,
  listReviews,
  refreshRating,
} from "@/lib/domain/data";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
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
    const reviews = await listReviews(barber);
    const users = await getMany(
      TABLES.users,
      reviews.map((review) => review.user),
    );
    const names = new Map(users.map((row) => [row.$id, String(row.name)]));

    return NextResponse.json({
      ok: true as const,
      reviews: reviews.map((review) => ({
        ...review,
        userName: names.get(review.user) ?? "Member",
      })),
    });
  } catch (error) {
    console.error("[api] reviews failed", error);
    return apiError("Could not load reviews.", 502, "reviews_failed");
  }
}

/** POST /api/reviews — rate a completed visit, once. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");

  const limit = rateLimit(`review:${member.user.id}`, 10, 60 * 60_000);
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
    const booking = await getBooking(parsed.data.booking);

    if (!booking || booking.user !== member.user.id) {
      return apiError("That visit is not on your account.", 404, "not_found");
    }

    if (booking.status !== "done") {
      return apiError("You can review a visit once it is completed.", 409, "not_done");
    }

    const existing = await getReviewByBooking(booking.id);
    if (existing) {
      return apiError("You already reviewed this visit.", 409, "already_reviewed");
    }

    const review = await createReview({
      user: member.user.id,
      barber: booking.barber,
      booking: booking.id,
      rate: parsed.data.rate,
      note: parsed.data.note,
    });

    const rating = await refreshRating(booking.barber);

    return NextResponse.json(
      { ok: true as const, review, rating },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api] review failed", error);
    return apiError("Could not save the review.", 502, "review_failed");
  }
}
