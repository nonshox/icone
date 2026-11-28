import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { getProfiles } from "@/lib/domain/account";
import { list } from "@/lib/domain/crud";
import { moderateReview } from "@/lib/domain/admin";
import { toReview } from "@/lib/domain/review";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const idSchema = z.object({
  id: z.string().trim().min(1, "Pick a review to moderate.").max(36),
});

const stateSchema = z.object({
  id: z.string().trim().min(1, "Pick a review to moderate.").max(36),
  state: z.enum(["open", "hidden"]),
});

/** GET /api/admin/reviews — all reviews, newest first, for moderation. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.reviews, [
      Query.orderDesc("$createdAt"),
      Query.limit(200),
    ]);
    const reviews = rows.map(toReview);
    const authors = await getProfiles(reviews.map((row) => row.user));

    return apiOk({
      reviews: reviews.map((review) => ({
        ...review,
        userName: authors.get(review.user)?.name ?? "",
        userAvatar: authors.get(review.user)?.avatar ?? "",
      })),
    });
  } catch (error) {
    console.error("[admin] reviews list failed", error);
    return apiError("Could not load reviews.", 502, "reviews_failed");
  }
}

/** DELETE /api/admin/reviews?id=… — hide a review and refresh its rating. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:reviews:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = idSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Pick a review.", 400, "invalid_id");
  }

  try {
    await moderateReview(parsed.data.id, "hidden", guard.actor.userId);
    return apiOk();
  } catch (error) {
    console.error("[admin] review moderation failed", error);
    return apiError("Could not hide the review.", 502, "review_failed");
  }
}

/** PATCH /api/admin/reviews — hide or restore a review explicitly. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:reviews:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = stateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the review.", 400, "invalid_review");
  }

  try {
    await moderateReview(parsed.data.id, parsed.data.state, guard.actor.userId);
    return apiOk();
  } catch (error) {
    console.error("[admin] review moderation failed", error);
    return apiError("Could not update the review.", 502, "review_failed");
  }
}
