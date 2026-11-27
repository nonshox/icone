import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { audit } from "@/lib/domain/audit";
import { list } from "@/lib/domain/crud";
import { allPortfolio, deletePortfolioItem, toPortfolioItem } from "@/lib/domain/portfolio";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an image to remove.").max(36),
});

/** GET /api/admin/portfolio?barber=… — submitted work for moderation. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const barber = request.nextUrl.searchParams.get("barber") ?? undefined;
    const items = barber
      ? await allPortfolio(barber)
      : (await list(TABLES.portfolio, [
          Query.orderDesc("$createdAt"),
          Query.limit(200),
        ])).map(toPortfolioItem);
    return apiOk({ items });
  } catch (error) {
    console.error("[admin] portfolio list failed", error);
    return apiError("Could not load portfolio images.", 502, "portfolio_failed");
  }
}

/** DELETE /api/admin/portfolio?id=… — remove an image after moderation. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:portfolio:${guard.actor.userId}`, 60, 10 * 60_000);
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
    await audit({
      actor: guard.actor.userId,
      action: "settings.change",
      kind: "portfolio",
      target: parsed.data.id,
      detail: "removed",
    });
    return apiOk();
  } catch (error) {
    console.error("[admin] portfolio delete failed", error);
    return apiError("Could not remove the image.", 502, "portfolio_failed");
  }
}
