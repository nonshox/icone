import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  listFavorites,
  removeFavorite,
  toggleFavorite,
} from "@/lib/domain/customer";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  barber: z.string().trim().min(1).max(36),
});

/** GET /api/favorites — saved chairs for the signed-in client. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  try {
    const favorites = await listFavorites(member.user.id);
    return NextResponse.json({ ok: true as const, favorites });
  } catch (error) {
    console.error("[api] favorites failed", error);
    return apiError("Could not load your saved chairs.", 502, "favorites_failed");
  }
}

/** POST /api/favorites — toggle one chair. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const limit = rateLimit(`favorites:${member.user.id}`, 40, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Pick a barber to save.", 400, "bad_barber");
  }

  try {
    const result = await toggleFavorite(member.user.id, parsed.data.barber);
    if (!result.favorite && result.saved) {
      return apiError("That chair is not taking bookings.", 404, "not_found");
    }
    return NextResponse.json({ ok: true as const, ...result });
  } catch (error) {
    console.error("[api] favorite toggle failed", error);
    return apiError("Could not update your saved chairs.", 502, "favorite_failed");
  }
}

/** DELETE /api/favorites?barber=… — remove one chair. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in first.", 401, "signed_out");
  if (member.profile.role !== "client") {
    return apiError("This area is for client accounts.", 403, "forbidden");
  }

  const barber = request.nextUrl.searchParams.get("barber") ?? "";
  if (!barber || barber.length > 36) {
    return apiError("Pick a barber to remove.", 400, "bad_barber");
  }

  try {
    await removeFavorite(member.user.id, barber);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[api] favorite remove failed", error);
    return apiError("Could not remove that chair.", 502, "favorite_failed");
  }
}
