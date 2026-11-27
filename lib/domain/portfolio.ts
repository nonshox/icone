import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, clean, create, first, list, num, remove, str, update, type Row } from "./crud";
import type { PortfolioItem } from "./types";

const SIZES = { url: 512, note: 128, group: 64 };

export function toPortfolioItem(row: Row): PortfolioItem {
  return {
    id: row.$id,
    barber: str(row.barber),
    url: str(row.url),
    note: str(row.note),
    group: str(row.group),
    sort: num(row.sort),
    featured: bool(row.featured),
    public: bool(row.public, true),
  };
}

/** The gallery a visitor is allowed to see. */
export async function publicPortfolio(barberId: string): Promise<PortfolioItem[]> {
  const rows = await list(TABLES.portfolio, [
    Query.equal("barber", barberId),
    Query.equal("public", true),
    Query.orderAsc("sort"),
    Query.limit(200),
  ]);
  return rows.map(toPortfolioItem);
}

/** Everything the owner can edit, hidden items included. */
export async function allPortfolio(barberId: string): Promise<PortfolioItem[]> {
  const rows = await list(TABLES.portfolio, [
    Query.equal("barber", barberId),
    Query.orderAsc("sort"),
    Query.limit(200),
  ]);
  return rows.map(toPortfolioItem);
}

export async function featuredPortfolio(barberId: string, limit = 6): Promise<PortfolioItem[]> {
  const rows = await list(TABLES.portfolio, [
    Query.equal("barber", barberId),
    Query.equal("public", true),
    Query.equal("featured", true),
    Query.orderAsc("sort"),
    Query.limit(limit),
  ]);
  return rows.map(toPortfolioItem);
}

/** Groups used to organise one professional's gallery. */
export async function portfolioGroups(barberId: string): Promise<string[]> {
  const rows = await allPortfolio(barberId);
  return [...new Set(rows.map((row) => row.group).filter(Boolean))];
}

export async function addPortfolioItem(input: {
  barber: string;
  url: string;
  note?: string;
  group?: string;
  featured?: boolean;
}): Promise<PortfolioItem> {
  const existing = await allPortfolio(input.barber);

  const row = await create(TABLES.portfolio, {
    barber: input.barber,
    url: clean(input.url, SIZES.url),
    note: clean(input.note ?? "", SIZES.note),
    group: clean(input.group ?? "", SIZES.group),
    sort: existing.length,
    featured: input.featured ?? false,
    public: true,
  });

  return toPortfolioItem(row);
}

export async function updatePortfolioItem(
  id: string,
  patch: Partial<PortfolioItem>,
): Promise<PortfolioItem> {
  const data: Record<string, unknown> = {};
  if (typeof patch.url === "string") data.url = clean(patch.url, SIZES.url);
  if (typeof patch.note === "string") data.note = clean(patch.note, SIZES.note);
  if (typeof patch.group === "string") data.group = clean(patch.group, SIZES.group);
  if (typeof patch.sort === "number") data.sort = Math.min(999, Math.max(0, patch.sort));
  if (typeof patch.featured === "boolean") data.featured = patch.featured;
  if (typeof patch.public === "boolean") data.public = patch.public;

  const row = await update(TABLES.portfolio, id, data);
  return toPortfolioItem(row);
}

/**
 * Delete one image. Nothing else points at it, so a hard delete is correct
 * here — unlike a service or an appointment, which history depends on.
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  await remove(TABLES.portfolio, id);
}

/**
 * Apply a new ordering in one call. The whole list is rewritten so the
 * positions shown in the editor are exactly the positions stored.
 */
export async function reorderPortfolio(
  barberId: string,
  orderedIds: string[],
): Promise<void> {
  const current = await allPortfolio(barberId);
  const known = new Set(current.map((row) => row.id));

  await Promise.all(
    orderedIds
      .filter((id) => known.has(id))
      .map((id, index) => update(TABLES.portfolio, id, { sort: index })),
  );
}

/** Only one featured image per professional keeps the profile tidy. */
export async function setFeatured(barberId: string, id: string): Promise<void> {
  const current = await allPortfolio(barberId);
  await Promise.all(
    current.map((row) =>
      update(TABLES.portfolio, row.id, { featured: row.id === id }),
    ),
  );
}

/** The first image shown when a profile card has no photo. */
export async function coverImage(barberId: string): Promise<string> {
  const featured = await featuredPortfolio(barberId, 1);
  if (featured.length > 0) return featured[0].url;

  const rows = await list(TABLES.portfolio, [
    Query.equal("barber", barberId),
    Query.equal("public", true),
    Query.orderAsc("sort"),
    Query.limit(1),
  ]);

  return rows.length > 0 ? str(rows[0].url) : "";
}

/** Cheap existence check used by the empty state. */
export async function hasPortfolio(barberId: string): Promise<boolean> {
  const row = await first(TABLES.portfolio, [Query.equal("barber", barberId)]);
  return row !== null;
}
