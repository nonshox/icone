import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { businessBySlug, isPublic, listBranches } from "./business";
import { first, get } from "./crud";
import { isBookable, toBarber } from "./professional";

/**
 * One short, shareable identifier for a bookable shop or chair. It is resolved
 * on the server only; nothing here trusts a client-supplied id as an
 * authorization decision — the booking flow validates the target again.
 */
export type BookingTarget = {
  business?: string;
  barber?: string;
  branch?: string;
  name: string;
};

async function primaryBranch(businessId: string): Promise<string | undefined> {
  const branches = await listBranches(businessId).catch(() => []);
  const branch =
    branches.find((row) => row.primary && row.active) ??
    branches.find((row) => row.active);
  return branch?.id || undefined;
}

/**
 * Resolve a `/b/<slug>` segment. Shops take precedence, then professional
 * slugs; a legacy row without a slug can still be reached by its document id.
 * Draft, suspended or switched-off profiles never produce a booking target.
 */
export async function resolveBookingTarget(
  slug: string,
): Promise<BookingTarget | null> {
  const key = slug.trim();
  if (!key || key.length > 64) return null;

  const business = await businessBySlug(key).catch(() => null);
  if (business && isPublic(business)) {
    return {
      business: business.id,
      branch: await primaryBranch(business.id),
      name: business.name,
    };
  }

  const row =
    (await first(TABLES.barbers, [Query.equal("slug", key)]).catch(() => null)) ??
    (await get(TABLES.barbers, key).catch(() => null));
  if (!row) return null;

  const barber = toBarber(row);
  if (!isBookable(barber)) return null;

  return { barber: barber.id, name: barber.name };
}
