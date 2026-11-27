import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { list, num, str } from "./crud";
import { distanceKm } from "./directory";
import { nextFree, getSlots } from "./availability";
import { servicesFor } from "./catalog";
import { isBookable, toBarber, type BarberRow } from "./professional";
import { toBusiness } from "./business";
import { shopClock } from "./time";
import type { Business, Service } from "./types";

/**
 * Discovery: search, filter and sort the marketplace.
 *
 * The candidate set is small enough (a city's worth of professionals) that
 * matching runs in memory, which is what lets one query understand Uzbek and
 * Russian spellings of the same street or name without a search index.
 */

/* ------------------------------------------------------------ text folding */

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", э: "e", ю: "yu", я: "ya", ь: "",
  // Uzbek Cyrillic
  ў: "o", ғ: "g", қ: "q", ҳ: "h",
};

/**
 * Fold a string so two spellings of the same word compare equal:
 * case, apostrophes (oʻzbek / o'zbek / ozbek) and Cyrillic/Latin lookalikes.
 */
export function fold(value: string): string {
  const lower = value.toLowerCase().trim();
  const withoutApostrophes = lower.replace(/[ʻʼ’‘`´'"’]/g, "");
  const spaced = withoutApostrophes.replace(/\s+/g, " ");

  let transliterated = "";
  for (const char of spaced) {
    transliterated += CYR_TO_LAT[char] ?? char;
  }
  return transliterated;
}

/** Every form a haystack can be matched against. */
export function foldAll(value: string): string[] {
  const raw = value.toLowerCase().replace(/\s+/g, " ").trim();
  const folded = fold(value);
  return [...new Set([raw, folded])].filter(Boolean);
}

/** True when the query appears in any spelling of the haystack. */
export function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const forms = foldAll(haystack);
  const query = fold(needle);
  if (!query) return true;
  return forms.some((form) => form.includes(query));
}

/* -------------------------------------------------------------- shapes */

export type SortKey =
  | "recommended"
  | "nearest"
  | "rating"
  | "price"
  | "soonest"
  | "reviews";

export const SORT_KEYS: readonly SortKey[] = [
  "recommended",
  "nearest",
  "rating",
  "price",
  "soonest",
  "reviews",
];

export type SearchQuery = {
  q?: string;
  city?: string;
  district?: string;
  type?: "all" | "barber" | "shop";
  /** Service id, or a category name such as "Beard". */
  service?: string;
  verified?: boolean;
  openNow?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** Must have a free slot inside this many days. */
  within?: number;
  lat?: number;
  lng?: number;
  sort?: SortKey;
  limit?: number;
};

export type SearchResult = {
  kind: "barber" | "shop";
  id: string;
  name: string;
  subtitle: string;
  photo: string;
  cover: string;
  rating: number;
  reviews: number;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  distance: number;
  price: number;
  verified: boolean;
  services: string[];
  next: { date: string; start: number } | null;
  openNow: boolean;
  slug: string;
};

/* ----------------------------------------------------------- candidates */

type Candidate = {
  kind: "barber" | "shop";
  id: string;
  name: string;
  subtitle: string;
  photo: string;
  cover: string;
  rating: number;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  verified: boolean;
  slug: string;
  haystack: string;
  price: number;
  services: string[];
  /** The professional who will actually hold the appointment. */
  anchor: string;
  reviewTarget: string;
  business: string;
};

async function barberCandidates(): Promise<Candidate[]> {
  // `state` is a later addition; legacy rows have it null and `toBarber`
  // normalizes that to active. Filter after mapping so they stay discoverable.
  const rows = await list(TABLES.barbers, [
    Query.equal("active", true),
    Query.limit(300),
  ]);

  const barbers = rows.map(toBarber).filter(isBookable);
  const out: Candidate[] = [];

  for (const barber of barbers) {
    // An employee is discovered through their shop; the shop's own profile
    // lists the team, which keeps one person from appearing twice.
    if (barber.business) continue;

    const offered = await servicesFor(barber.id);
    if (offered.length === 0) continue;

    out.push({
      kind: "barber",
      id: barber.id,
      name: barber.name,
      subtitle: barber.title || "Barber",
      photo: barber.photo,
      cover: barber.cover,
      rating: barber.rating,
      city: barber.city,
      district: barber.district,
      address: barber.address || barber.shop,
      lat: barber.lat,
      lng: barber.lng,
      verified: barber.verified,
      slug: barber.slug || barber.id,
      haystack: [
        barber.name,
        barber.title,
        barber.skills,
        barber.shop,
        barber.address,
        barber.district,
        barber.city,
        barber.bio,
      ].join(" "),
      price: Math.min(...offered.map((offer) => offer.ownPrice)),
      services: offered.map((offer) => offer.name),
      anchor: barber.id,
      reviewTarget: barber.id,
      business: "",
    });
  }

  return out;
}

async function shopCandidates(): Promise<Candidate[]> {
  const rows = await list(TABLES.businesses, [
    Query.equal("state", "active"),
    Query.equal("active", true),
    Query.limit(300),
  ]);

  const businesses = rows.map(toBusiness);
  const out: Candidate[] = [];

  for (const business of businesses) {
    const staff = await list(TABLES.barbers, [
      Query.equal("business", business.id),
      Query.equal("active", true),
      Query.limit(100),
    ]);

    const professionals = staff.map(toBarber).filter(isBookable);
    if (professionals.length === 0) continue;

    // The shop's own menu is the union of what its staff can do.
    const menu = await list(TABLES.services, [
      Query.equal("business", business.id),
      Query.equal("active", true),
      Query.limit(200),
    ]);

    const names = menu.map((row) => str(row.name)).filter(Boolean);
    const prices = menu.map((row) => num(row.price)).filter((value) => value > 0);

    out.push({
      kind: "shop",
      id: business.id,
      name: business.name,
      subtitle: `${professionals.length} ${professionals.length === 1 ? "barber" : "barbers"}`,
      photo: business.logo,
      cover: business.cover,
      rating: business.rating,
      city: business.city,
      district: business.district,
      address: business.address,
      lat: business.lat,
      lng: business.lng,
      verified: business.verified,
      slug: business.slug || business.id,
      haystack: [
        business.name,
        business.about,
        business.address,
        business.district,
        business.city,
        business.facilities,
        ...names,
        ...professionals.map((row) => row.name),
      ].join(" "),
      price: prices.length > 0 ? Math.min(...prices) : 0,
      services: names,
      anchor: professionals[0].id,
      reviewTarget: professionals[0].id,
      business: business.id,
    });
  }

  return out;
}

/* ----------------------------------------------------------- availability */

/** Whether a professional is taking anyone in right now. */
export async function isOpenNow(barberId: string): Promise<boolean> {
  const clock = shopClock();
  const slots = await getSlots({ barber: barberId, date: clock.date, time: 30 });
  return slots.length > 0;
}

async function withNext(
  candidate: Candidate,
  withinDays: number,
): Promise<{ date: string; start: number } | null> {
  const free = await nextFree({
    barber: candidate.anchor,
    time: 30,
    days: withinDays,
  });
  return free ? { date: free.date, start: free.start } : null;
}

/* --------------------------------------------------------------- search */

export async function search(query: SearchQuery = {}): Promise<SearchResult[]> {
  const type = query.type ?? "all";
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));

  const candidates: Candidate[] = [];
  if (type === "all" || type === "barber") candidates.push(...(await barberCandidates()));
  if (type === "all" || type === "shop") candidates.push(...(await shopCandidates()));

  const needle = query.q?.trim() ?? "";
  const within = query.within ?? 7;

  const filtered = candidates.filter((candidate) => {
    if (needle && !matches(candidate.haystack, needle)) return false;
    if (query.city && candidate.city !== query.city) return false;
    if (query.district && candidate.district !== query.district) return false;
    if (query.verified && !candidate.verified) return false;
    if (typeof query.minPrice === "number" && candidate.price < query.minPrice) return false;
    if (typeof query.maxPrice === "number" && candidate.price > query.maxPrice) return false;
    if (typeof query.minRating === "number" && candidate.rating < query.minRating) return false;
    if (query.service && !serviceMatches(candidate, query.service)) return false;
    return true;
  });

  const origin =
    typeof query.lat === "number" && typeof query.lng === "number"
      ? { lat: query.lat, lng: query.lng }
      : null;

  const withDistance = filtered.map((candidate) => ({
    candidate,
    distance: origin ? distanceKm(origin, { lat: candidate.lat, lng: candidate.lng }) : 0,
  }));

  // Review counts are one query for everybody, not one per result.
  const counts = await reviewCounts(filtered.map((row) => row.reviewTarget));

  // "Open now" and "earliest available" are the expensive checks, so they
  // only run on the rows that already passed the cheap filters.
  const needsLive = query.openNow || query.sort === "soonest" || !!query.within;
  const checked = needsLive
    ? await Promise.all(
        withDistance.map(async (row) => {
          const next = await withNext(row.candidate, within);
          const open = query.openNow ? await isOpenNow(row.candidate.anchor) : true;
          return { ...row, next, open };
        }),
      )
    : withDistance.map((row) => ({ ...row, next: null, open: true }));

  const visible = checked.filter((row) => {
    if (query.openNow && !row.open) return false;
    if (query.within && !row.next) return false;
    return true;
  });

  const sort = query.sort ?? "recommended";

  visible.sort((a, b) => {
    switch (sort) {
      case "nearest":
        return a.distance - b.distance;
      case "rating":
        return b.candidate.rating - a.candidate.rating;
      case "price":
        return a.candidate.price - b.candidate.price;
      case "reviews":
        return (counts.get(b.candidate.reviewTarget) ?? 0) - (counts.get(a.candidate.reviewTarget) ?? 0);
      case "soonest":
        return compareNext(a.next, b.next);
      case "recommended":
      default:
        return recommend(a, b, counts, origin);
    }
  });

  return visible.slice(0, limit).map((row) => ({
    kind: row.candidate.kind,
    id: row.candidate.id,
    name: row.candidate.name,
    subtitle: row.candidate.subtitle,
    photo: row.candidate.photo,
    cover: row.candidate.cover,
    rating: row.candidate.rating,
    reviews: counts.get(row.candidate.reviewTarget) ?? 0,
    city: row.candidate.city,
    district: row.candidate.district,
    address: row.candidate.address,
    lat: row.candidate.lat,
    lng: row.candidate.lng,
    distance: row.distance,
    price: row.candidate.price,
    verified: row.candidate.verified,
    services: row.candidate.services.slice(0, 4),
    next: row.next,
    openNow: row.open,
    slug: row.candidate.slug,
  }));
}

function compareNext(
  a: { date: string; start: number } | null,
  b: { date: string; start: number } | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.start - b.start;
}

/**
 * Recommended order: real signal only — rating, how many people reviewed,
 * whether they can see you soon, and distance when we know where you are.
 * Nothing here is paid for.
 */
function recommend(
  a: { candidate: Candidate; distance: number; next: { date: string; start: number } | null },
  b: { candidate: Candidate; distance: number; next: { date: string; start: number } | null },
  reviews: Map<string, number>,
  origin: { lat: number; lng: number } | null,
): number {
  const score = (row: typeof a): number => {
    const rating = row.candidate.rating;
    const count = reviews.get(row.candidate.reviewTarget) ?? 0;
    let total = rating * 20 + Math.min(count, 50) * 1.5;

    if (row.candidate.verified) total += 8;
    if (row.next) {
      const days = daysAway(row.next.date);
      total += Math.max(0, 24 - days * 3);
    }
    if (origin && row.distance > 0) total += Math.max(0, 20 - row.distance * 2);
    return total;
  };

  return score(b) - score(a);
}

function daysAway(date: string): number {
  const today = shopClock().date;
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86_400_000);
}

function serviceMatches(candidate: Candidate, service: string): boolean {
  if (!service) return true;
  const needle = fold(service);
  return candidate.services.some((name) => fold(name).includes(needle));
}

async function reviewCounts(ids: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const rows = await list(TABLES.reviews, [
    Query.equal("barber", unique),
    Query.equal("state", "open"),
    Query.limit(500),
  ]);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = str(row.barber);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------ supporting feeds */

export type FeedBarber = SearchResult & { barber: BarberRow };

/** The homepage's "available today" row. */
export async function availableToday(limit = 8): Promise<SearchResult[]> {
  const clock = shopClock();
  const results = await search({ sort: "soonest", within: 1, limit: limit * 3 });
  return results.filter((row) => row.next?.date === clock.date).slice(0, limit);
}

/** The homepage's "nearby" row, given the visitor's coordinates. */
export async function nearby(
  origin: { lat: number; lng: number },
  limit = 8,
): Promise<SearchResult[]> {
  return search({ sort: "nearest", lat: origin.lat, lng: origin.lng, limit });
}

/** The most-reviewed professionals, for the homepage. */
export async function popular(limit = 8): Promise<SearchResult[]> {
  return search({ sort: "reviews", limit });
}

/** The best-rated professionals, for the homepage. */
export async function topRated(limit = 8): Promise<SearchResult[]> {
  return search({ sort: "rating", limit });
}

/** A business's own services, used on the public shop profile. */
export async function shopServices(business: Business): Promise<Service[]> {
  const rows = await list(TABLES.services, [
    Query.equal("business", business.id),
    Query.equal("active", true),
    Query.orderAsc("sort"),
    Query.limit(200),
  ]);

  return rows.map((row) => ({
    id: row.$id,
    barber: str(row.barber),
    business: str(row.business),
    name: str(row.name),
    note: str(row.note),
    price: num(row.price),
    time: num(row.time, 30) || 30,
    buffer: num(row.buffer),
    active: true,
    image: str(row.image),
    category: str(row.category, "Hair"),
    featured: false,
    sort: num(row.sort),
  }));
}
