import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { deleteReview, listAllReviews } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const idSchema = z.object({
  id: z.string().trim().min(1, "Pick a review to remove.").max(36),
});

/** GET /api/admin/reviews — all reviews for moderation. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to moderate reviews.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      reviews: await listAllReviews(),
    });
  } catch (error) {
    console.error("[admin] reviews list failed", error);
    return apiError("Could not load reviews.", 502, "reviews_failed");
  }
}

/** DELETE /api/admin/reviews?id=… — remove a review. Admin only. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to moderate reviews.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can moderate reviews.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:reviews:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = idSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Pick a review.",
      400,
      "invalid_id",
    );
  }

  try {
    await deleteReview(parsed.data.id);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] review delete failed", error);
    return apiError("Could not remove the review.", 502, "review_failed");
  }
}
