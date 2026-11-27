import "server-only";

import type { NextRequest } from "next/server";

import { busyFor, isBookableDate, getSlots } from "@/lib/domain/availability";
import { visitDuration } from "@/lib/domain/booking";
import { resolveOffer } from "@/lib/domain/catalog";
import { getBarber, isBookable, listBusinessBarbers } from "@/lib/domain/professional";
import { visitPrice } from "@/lib/domain/pricing";
import { apiError, apiOk } from "@/lib/http";
import type { BarberRow } from "@/lib/domain/professional";
import type { OfferedService } from "@/lib/domain/types";

/**
 * GET /api/availability?barber=&date=&services=<id>&services=<id> — free starts.
 *
 * `service=<id>` is still accepted for one-item visits. Every service is
 * resolved against this employee so a multi-service visit gets one duration
 * (buffer included) and one price, computed on the server.
 *
 * `any=1&business=&branch=` asks the server to pick the first qualified
 * employee with a free slot on that date — the "any available barber" flow.
 */

async function offersFor(
  barberId: string,
  services: string[],
): Promise<OfferedService[] | null> {
  const offers: OfferedService[] = [];
  for (const service of services) {
    const offer = await resolveOffer(barberId, service);
    if (!offer || !offer.active || !offer.assigned) return null;
    offers.push(offer);
  }
  return offers;
}

function envelope(
  barber: BarberRow,
  offers: OfferedService[],
  slots: Awaited<ReturnType<typeof getSlots>>,
) {
  return {
    barber: barber.id,
    barberName: barber.name,
    slots,
    time: visitDuration(offers, barber.buffer),
    price: visitPrice(offers),
    services: offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      price: offer.ownPrice,
      time: offer.ownTime,
    })),
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("barber") ?? "";
  const business = params.get("business") ?? "";
  const branch = params.get("branch") ?? "";
  const any = params.get("any") === "1" || requested === "any";
  const date = params.get("date") ?? "";
  const listed = params.getAll("services").flatMap((value) => value.split(","));
  const single = params.get("service");
  const services = [
    ...new Set(
      [...listed, ...(single ? [single] : [])]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);

  if (!requested && !any) {
    return apiError("Pick a barber first.", 400, "no_barber");
  }
  if (!isBookableDate(date)) {
    return apiError("Pick a valid date.", 400, "bad_date");
  }
  if (services.length === 0) {
    return apiError("Pick a service first.", 400, "no_service");
  }

  try {
    if (any) {
      if (!business) {
        return apiError("Pick a barbershop first.", 400, "no_business");
      }
      const staff = (await listBusinessBarbers(business))
        .filter((row) => isBookable(row) && (!branch || row.branch === branch));

      // Fresha-style assignment: among eligible professionals, give the visit
      // to the one with the most free time that day, not simply the first row.
      const options: Array<{
        candidate: (typeof staff)[number];
        offers: OfferedService[];
        slots: Awaited<ReturnType<typeof getSlots>>;
        workload: number;
      }> = [];
      for (const candidate of staff) {
        const offers = await offersFor(candidate.id, services);
        if (!offers) continue;
        const time = visitDuration(offers, candidate.buffer);
        const slots = await getSlots({ barber: candidate.id, date, time });
        if (slots.length === 0) continue;
        const busy = await busyFor(candidate.id, date);
        const workload = busy.reduce(
          (minutes, row) => minutes + Math.max(0, row.end - row.start),
          0,
        );
        options.push({ candidate, offers, slots, workload });
      }
      if (options.length > 0) {
        options.sort((a, b) => a.workload - b.workload || a.candidate.id.localeCompare(b.candidate.id));
        const chosen = options[0];
        return apiOk(envelope(chosen.candidate, chosen.offers, chosen.slots));
      }
      return apiOk({
        barber: "",
        barberName: "",
        slots: [],
        time: 0,
        price: 0,
        services: [],
      });
    }

    const chair = await getBarber(requested);
    if (!chair || !isBookable(chair)) {
      return apiError("That barber is not taking bookings.", 404, "no_barber");
    }
    const offers = await offersFor(requested, services);
    if (!offers) {
      return apiError("That service belongs to another chair.", 400, "wrong_chair");
    }
    const slots = await getSlots({ barber: requested, date, time: visitDuration(offers, chair.buffer) });
    return apiOk(envelope(chair, offers, slots));
  } catch (error) {
    console.error("[api] availability failed", error);
    return apiError("Could not load times.", 502, "availability_failed");
  }
}
