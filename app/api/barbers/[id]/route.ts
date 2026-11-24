import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { TABLES } from "@/lib/appwrite/db";
import {
  getBarber,
  getMany,
  listHours,
  listReviews,
} from "@/lib/domain/data";
import { apiError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/barbers/:id — profile, weekly hours and public reviews.
 * The booking screen only needs the list, but a detail page can use this.
 */
export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;

  try {
    const barber = await getBarber(id);
    if (!barber) return apiError("Barber not found.", 404, "not_found");

    const [hours, reviews] = await Promise.all([
      listHours(id),
      listReviews(id),
    ]);

    const users = await getMany(
      TABLES.users,
      reviews.map((review) => review.user),
    );
    const names = new Map(users.map((row) => [row.$id, String(row.name)]));

    return NextResponse.json({
      ok: true as const,
      barber,
      hours,
      reviews: reviews.map((review) => ({
        ...review,
        userName: names.get(review.user) ?? "Member",
      })),
    });
  } catch (error) {
    console.error("[api] barber detail failed", error);
    return apiError("Could not load the barber.", 502, "barber_failed");
  }
}
