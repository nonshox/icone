import "server-only";

import { Query } from "node-appwrite";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { getActor } from "@/lib/domain/access";
import { TABLES } from "@/lib/appwrite/db";
import { create, list, remove, str } from "@/lib/domain/crud";
import { getBarber, getBarbers, isBookable, type BarberRow } from "@/lib/domain/professional";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  barber: z.string().trim().min(1).max(36),
});

/** The shape the saved-chairs UI has always consumed. */
type Favorite = {
  id: string;
  barber: string;
  name: string;
  title: string;
  photo: string;
  rating: number;
  shop: string;
  address: string;
  city: string;
};

function toFavorite(barber: BarberRow): Favorite {
  return {
    id: barber.id,
    barber: barber.id,
    name: barber.name,
    title: barber.title,
    photo: barber.photo,
    rating: barber.rating,
    shop: barber.shop,
    address: barber.address,
    city: barber.city,
  };
}

async function favoriteRows(userId: string, barberId?: string) {
  return list(TABLES.favorites, [
    Query.equal("user", userId),
    ...(barberId ? [Query.equal("barber", barberId)] : []),
    Query.limit(100),
  ]);
}

async function listFavorites(userId: string): Promise<Favorite[]> {
  const rows = await favoriteRows(userId);
  if (rows.length === 0) return [];

  const barbers = await getBarbers(rows.map((row) => str(row.barber)));
  return rows
    .map((row) => barbers.get(str(row.barber)))
    .filter((barber): barber is BarberRow => Boolean(barber))
    .map(toFavorite);
}

/** GET /api/favorites — saved chairs for the signed-in client. */
export async function GET() {
  // Public profile pages render this button for everybody. Guests and
  // professional accounts simply get an empty list; only writes are gated.
  const actor = await getActor();
  if (!actor) {
    return apiOk({ favorites: [] });
  }

  try {
    return apiOk({ favorites: await listFavorites(actor.userId) });
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

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  
  const limit = rateLimit(`favorites:${guarded.actor.userId}`, 40, 10 * 60_000);
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
    const userId = guarded.actor.userId;
    const barberId = parsed.data.barber;
    const rows = await favoriteRows(userId, barberId);

    if (rows.length > 0) {
      await Promise.all(rows.map((row) => remove(TABLES.favorites, row.$id)));
      return apiOk({ saved: false, favorite: null });
    }

    const barber = await getBarber(barberId);
    if (!barber || !isBookable(barber)) {
      return apiError("That chair is not taking bookings.", 404, "not_found");
    }
    await create(TABLES.favorites, { user: userId, barber: barberId });
    return apiOk({ saved: true, favorite: toFavorite(barber) });
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

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  
  const barber = request.nextUrl.searchParams.get("barber") ?? "";
  if (!barber || barber.length > 36) {
    return apiError("Pick a barber to remove.", 400, "bad_barber");
  }

  try {
    const rows = await favoriteRows(guarded.actor.userId, barber);
    await Promise.all(rows.map((row) => remove(TABLES.favorites, row.$id)));
    return apiOk();
  } catch (error) {
    console.error("[api] favorite remove failed", error);
    return apiError("Could not remove that chair.", 502, "favorite_failed");
  }
}

