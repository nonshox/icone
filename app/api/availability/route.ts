import "server-only";

import type { NextRequest } from "next/server";

import { isBookableDate, getSlots } from "@/lib/domain/availability";
import { visitDuration } from "@/lib/domain/booking";
import { getService, resolveOffer } from "@/lib/domain/catalog";
import { getBarber, isBookable } from "@/lib/domain/professional";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/availability?barber=&date=&service= — free start times. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const barber = params.get("barber") ?? "";
  const date = params.get("date") ?? "";
  const service = params.get("service") ?? "";

  if (!barber) {
    return apiError("Pick a barber first.", 400, "no_barber");
  }

  if (!isBookableDate(date)) {
    return apiError("Pick a valid date.", 400, "bad_date");
  }

  try {
    const [chair, item] = await Promise.all([
      getBarber(barber),
      getService(service),
    ]);

    if (!chair || !isBookable(chair)) {
      return apiError("That barber is not taking bookings.", 404, "no_barber");
    }
    if (!item || !item.active) {
      return apiError("Pick a service first.", 400, "no_service");
    }

    // A shared service only belongs to the employees assigned to it.
    const offer = await resolveOffer(barber, service);
    if (!offer || !offer.active) {
      return apiError("That service belongs to another chair.", 400, "wrong_chair");
    }

    const time = visitDuration([offer], chair.buffer);
    const slots = await getSlots({ barber, date, time });
    return apiOk({ slots, time });
  } catch (error) {
    console.error("[api] availability failed", error);
    return apiError("Could not load times.", 502, "availability_failed");
  }
}
