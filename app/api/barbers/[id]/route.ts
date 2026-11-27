import "server-only";

import type { NextRequest } from "next/server";

import { servicesFor } from "@/lib/domain/catalog";
import { publicPortfolio } from "@/lib/domain/portfolio";
import { getBarber } from "@/lib/domain/professional";
import { reviewsWithAuthors } from "@/lib/domain/review";
import { getBarberHours } from "@/lib/domain/schedule";
import { apiError, apiOk } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/barbers/:id — profile, weekly hours, menu, gallery and public
 * reviews. The booking screen only needs the list, but the profile page uses
 * this one document bundle.
 */
export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;

  try {
    const barber = await getBarber(id);
    if (!barber) return apiError("Barber not found.", 404, "not_found");

    const [hours, reviews, services, portfolio] = await Promise.all([
      getBarberHours(id),
      reviewsWithAuthors(id),
      servicesFor(id),
      publicPortfolio(id),
    ]);

    return apiOk({
      barber,
      hours,
      reviews: reviews.map((review) => ({
        ...review,
        userName: review.userName || "Member",
      })),
      services,
      portfolio,
    });
  } catch (error) {
    console.error("[api] barber detail failed", error);
    return apiError("Could not load the barber.", 502, "barber_failed");
  }
}
