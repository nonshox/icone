import "server-only";

import type { NextRequest } from "next/server";

import { isBookableDate, getSlots } from "@/lib/domain/availability";
import { visitDuration } from "@/lib/domain/booking";
import { resolveOffer } from "@/lib/domain/catalog";
import { getBarber, isBookable } from "@/lib/domain/professional";
import { visitPrice } from "@/lib/domain/pricing";
import { apiError, apiOk } from "@/lib/http";
import type { OfferedService } from "@/lib/domain/types";

/**
 * GET /api/availability?barber=&date=&services=<id>&services=<id> — free starts.
 *
 * `service=<id>` is still accepted for one-item visits. Every service is
 * resolved against this employee so a multi-service visit gets one duration
 * (buffer included) and one price, computed on the server.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const barber = params.get("barber") ?? "";
  const date = params.get("date") ?? "";
  const listed = params.getAll("services").flatMap((value) => value.split(","));
  const single = params.get("service");
  const services = [...new Set([...listed, ...(single ? [single] : [])].map((id) => id.trim()).filter(Boolean))].slice(0, 10);

  if (!barber) {
    return apiError("Pick a barber first.", 400, "no_barber");
  }

  if (!isBookableDate(date)) {
    return apiError("Pick a valid date.", 400, "bad_date");
  }

  try {
    if (services.length === 0) {
      return apiError("Pick a service first.", 400, "no_service");
    }

    const chair = await getBarber(barber);
    if (!chair || !isBookable(chair)) {
      return apiError("That barber is not taking bookings.", 404, "no_barber");
    }

    // A shared service only belongs to the employees assigned to it.
    const offers: OfferedService[] = [];
    for (const service of services) {
      const offer = await resolveOffer(barber, service);
      if (!offer || !offer.active) {
        return apiError("That service belongs to another chair.", 400, "wrong_chair");
      }
      offers.push(offer);
    }

    const time = visitDuration(offers, chair.buffer);
    const slots = await getSlots({ barber, date, time });
    return apiOk({
      slots,
      time,
      price: visitPrice(offers),
      services: offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        price: offer.ownPrice,
        time: offer.ownTime,
      })),
    });
  } catch (error) {
    console.error("[api] availability failed", error);
    return apiError("Could not load times.", 502, "availability_failed");
  }
}
