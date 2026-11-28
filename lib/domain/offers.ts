import "server-only";

import { AppwriteException, Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, create, first, get, list, num, str, update, type Row } from "./crud";
import type { Offer, OfferedService, Service } from "./types";

export type { Offer } from "./types";

/**
 * Tier-2 materialised offers.
 *
 * The legacy source of truth is `services` plus the per-employee `empser`
 * overrides, where -1 means "inherit". That calculation is still what every
 * caller gets when an `offers` row has not been written yet, so a rollout can
 * land the schema and the backfill in any order. Once a row exists it is the
 * authority for price, duration and assignment; its values are always explicit
 * so no -1 sentinel ever reaches a booking.
 *
 * `TABLES` gains `offers` with the Tier-2 schema. The cast keeps this module
 * compiling while the schema change is still landing; after that it resolves
 * to the canonical table id.
 */
const OFFERS = (TABLES as Record<string, string | undefined>).offers ?? "offers";

export type OfferInput = {
  barber: string;
  service: string;
  business?: string;
  /** Omit, or pass -1, to inherit from the current calculation. */
  price?: number;
  time?: number;
  active?: boolean;
  sort?: number;
};

export function toOffer(row: Row): Offer {
  return {
    id: row.$id,
    barber: str(row.barber),
    service: str(row.service),
    business: str(row.business),
    price: num(row.price, -1),
    time: num(row.time, -1),
    active: bool(row.active, true),
    sort: num(row.sort),
  };
}

/** A missing collection is the expected state before the schema migration. */
function collectionMissing(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404;
}

/** The active price and time one employee actually charges, never -1. */
async function explicitPriceTime(
  barber: string,
  serviceId: string,
  price?: number,
  time?: number,
): Promise<{ price: number; time: number; business: string } | null> {
  const service = await get(TABLES.services, serviceId);
  if (!service) return null;

  const basePrice = Math.max(0, Math.round(num(service.price)));
  const baseTime = Math.min(480, Math.max(5, Math.round(num(service.time, 30) || 30)));

  const override = await first(TABLES.empser, [
    Query.equal("barber", barber),
    Query.equal("service", serviceId),
  ]);
  const inheritedPrice = override ? num(override.price, -1) : -1;
  const inheritedTime = override ? num(override.time, -1) : -1;

  const chosenPrice =
    typeof price === "number" && price >= 0
      ? price
      : inheritedPrice >= 0
        ? inheritedPrice
        : basePrice;
  const chosenTime =
    typeof time === "number" && time >= 5
      ? time
      : inheritedTime >= 0
        ? inheritedTime
        : baseTime;

  return {
    price: Math.max(0, Math.round(chosenPrice)),
    time: Math.min(480, Math.max(5, Math.round(chosenTime))),
    business: str(service.business),
  };
}

/* ------------------------------------------------------------------ reads */

/** The materialised row for one (barber, service) pair, if it exists. */
export async function findOffer(barber: string, service: string): Promise<Offer | null> {
  if (!barber || !service) return null;
  try {
    const row = await first(OFFERS, [
      Query.equal("barber", barber),
      Query.equal("service", service),
    ]);
    return row ? toOffer(row) : null;
  } catch (error) {
    if (collectionMissing(error)) return null;
    throw error;
  }
}

/** All materialised rows for one barber, including deactivated ones. */
export async function listOffers(barber: string): Promise<Offer[]> {
  if (!barber) return [];
  try {
    const rows = await list(OFFERS, [Query.equal("barber", barber), Query.limit(200)]);
    return rows.map(toOffer);
  } catch (error) {
    if (collectionMissing(error)) return [];
    throw error;
  }
}

/**
 * Apply a materialised offer to the service it points at.
 *
 * A corrupt row is degraded to the service's own values rather than leaking a
 * negative price or a zero-length visit into a booking.
 */
export function applyOffer(offer: Offer, service: Service): OfferedService {
  const price = offer.price >= 0 ? offer.price : service.price;
  const time = offer.time >= 5 ? offer.time : service.time;
  return {
    ...service,
    price,
    time,
    ownPrice: price,
    ownTime: time,
    assigned: true,
  };
}

/**
 * Read offers first; fall back to the legacy calculation only when no row has
 * been materialised. An inactive row means "unassigned", never "inherit".
 *
 * The imports of `catalog` are dynamic on purpose: `catalog` reads this module
 * synchronously, so a static import back would form a require cycle.
 */
export async function offerFor(
  barber: string,
  service: string,
): Promise<OfferedService | null> {
  const offer = await findOffer(barber, service);
  if (offer) {
    if (!offer.active) return null;
    const { getService } = await import("./catalog");
    const row = await getService(service);
    return row && row.active ? applyOffer(offer, row) : null;
  }

  const { resolveOfferBase } = await import("./catalog");
  return resolveOfferBase(barber, service);
}

/* ----------------------------------------------------------------- writes */

/** Create or refresh the explicit row for one employee and service. */
export async function upsertOffer(input: OfferInput): Promise<Offer | null> {
  if (!input.barber || !input.service) return null;

  const effective = await explicitPriceTime(
    input.barber,
    input.service,
    input.price,
    input.time,
  );
  if (!effective) return null; // Retired/deleted service: never write a sentinel.

  const data = {
    barber: input.barber,
    service: input.service,
    business: input.business ?? effective.business,
    price: effective.price,
    time: effective.time,
    active: input.active ?? true,
    sort: Math.min(999, Math.max(0, Math.round(input.sort ?? 0))),
  };

  const current = await findOffer(input.barber, input.service);
  try {
    const row = current
      ? await update(OFFERS, current.id, data)
      : await create(OFFERS, data);
    return toOffer(row);
  } catch (error) {
    // Two writes can race on the unique (barber, service) pair. Converge on
    // the winner's row instead of surfacing a conflict to the user.
    if (error instanceof AppwriteException && error.code === 409) {
      const winner = await findOffer(input.barber, input.service);
      if (winner) return toOffer(await update(OFFERS, winner.id, data));
    }
    throw error;
  }
}

/** Mark one assignment inactive; the historical row stays in place. */
export async function deactivateOffer(barber: string, service: string): Promise<Offer | null> {
  const current = await findOffer(barber, service);
  if (!current || !current.active) return null;
  try {
    return toOffer(await update(OFFERS, current.id, { active: false }));
  } catch (error) {
    if (collectionMissing(error)) return null;
    throw error;
  }
}
