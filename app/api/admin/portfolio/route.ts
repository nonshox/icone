import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { deletePortfolioItem, listPortfolio } from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an image to remove.").max(36),
});

/** GET /api/admin/portfolio?barber=… — submitted work for moderation. */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to moderate the portfolio.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    const barber = request.nextUrl.searchParams.get("barber") ?? undefined;
    return NextResponse.json({
      ok: true as const,
      items: await listPortfolio(barber),
    });
  } catch (error) {
    console.error("[admin] portfolio list failed", error);
    return apiError("Could not load portfolio images.", 502, "portfolio_failed");
  }
}

/** DELETE /api/admin/portfolio?id=… — remove an inappropriate image. Admin only. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to moderate the portfolio.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can moderate the portfolio.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:portfolio:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Pick an image.",
      400,
      "invalid_id",
    );
  }

  try {
    await deletePortfolioItem(parsed.data.id);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] portfolio delete failed", error);
    return apiError("Could not remove the image.", 502, "portfolio_failed");
  }
}
