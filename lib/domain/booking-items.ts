import "server-only";

import { parseItems } from "./booking";
import type { BookingItemSnapshot, OfferedService } from "./types";

/**
 * A booked visit keeps its own copy of what was reserved.
 *
 * Prices, names and durations change in the catalogue; a historical booking
 * must still show what the client actually agreed to. The snapshot is stored
 * as JSON in `bookings.items`, alongside the primary `service` id.
 */

/** Serialize the resolved offers of one visit, in performance order. */
export function snapshotOffers(offers: OfferedService[]): BookingItemSnapshot[] {
  if (!Array.isArray(offers)) return [];
  return offers
    .map((offer) => ({
      service: offer.id,
      name: offer.name || offer.id,
      price: Number.isFinite(offer.ownPrice) ? Math.max(0, Math.round(offer.ownPrice)) : 0,
      time: Number.isFinite(offer.ownTime) ? Math.max(0, Math.round(offer.ownTime)) : 0,
    }))
    .filter((item) => Boolean(item.service));
}

/**
 * Read a booking's `items` column without ever throwing on old or corrupt
 * data. `parseItems()` understands both legacy id arrays and snapshots; this
 * wrapper keeps the shape stable even if an older row carries only an id.
 */
export function describeItems(value: unknown): BookingItemSnapshot[] {
  let parsed: unknown = [];
  try {
    parsed = parseItems(value);
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => {
    const row = (entry && typeof entry === "object"
      ? entry
      : { service: entry }) as Record<string, unknown>;
    const service = typeof row.service === "string" ? row.service.trim() : "";
    const name = typeof row.name === "string" && row.name.trim() ? row.name : service;
    const price =
      typeof row.price === "number" && Number.isFinite(row.price)
        ? Math.max(0, Math.round(row.price))
        : 0;
    const time =
      typeof row.time === "number" && Number.isFinite(row.time)
        ? Math.max(0, Math.round(row.time))
        : 0;
    return { service, name, price, time };
  }).filter((item) => Boolean(item.service));
}
