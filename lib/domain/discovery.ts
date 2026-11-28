import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { list, num, str, type Row } from "./crud";
import { distanceKm } from "./directory";
import { nextFree, getSlots } from "./availability";
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

/**
 * Read every page of one small collection slice. A city's worth of rows fits
 * in a couple of pages; paging instead of a hard `limit` keeps busy menus and
 * review trails from silently truncating the candidate set.
 */
async function paged(
  table: string,
  queries: string[],
  page = 200,
  maxRows = 4000,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < maxRows; offset += page) {
    const batch = await list(table, [
      ...queries,
      Query.limit(page),
      Query.offset(offset),
    ]);
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

/**
 * Batch-read rows by an owner field. Appwrite caps how many values one
 * `Query.equal` may carry, so ids are chunked exactly like `getMany()` does,
 * then grouped in memory by the caller.
 */
async function pagedByField(
  table: string,
  field: string,
  ids: string[],
  others: string[],
  page = 200,
  maxPerChunk = 2000,
): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: Row[] = [];
  for (let offset = 0; offset < unique.length; offset += 50) {
    rows.push(
      ...(await paged(
        table,
        [Query.equal(field, unique.slice(offset, offset + 50)), ...others],
        page,
        maxPerChunk,
      )),
    );
  }
  return rows;
}

function groupBy(rows: Row[], key: (row: Row) => string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const bucket = out.get(id) ?? [];
    bucket.push(row);
    out.set(id, bucket);
  }
  return out;
}

async function barberCandidates(): Promise<Candidate[]> {
  // `state` is a later addition; legacy rows have it null and `toBarber`
  // normalizes that to active. Filter after mapping so they stay discoverable.
  const rows = await paged(TABLES.barbers, [Query.equal("active", true)], 300, 600);
  const barbers = rows.map(toBarber).filter(isBookable);
  const out: Candidate[] = [];

  for (const barber of barbers) {
    // An employee is discovered through their shop; the shop's own profile
    // lists the team, which keeps one person from appearing twice.
    if (barber.business) continue;

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
      price: 0,
      services: [],
      anchor: barber.id,
      reviewTarget: barber.id,
      business: "",
    });
  }

  return out;
}

/**
 * One services query for every independent barber at once, then group in
 * memory. The old code made one query per candidate before it even knew which
 * ones would survive filtering.
 */
async function attachIndependentServices(candidates: Candidate[]): Promise<Candidate[]> {
  const ids = candidates.filter((row) => row.kind === "barber").map((row) => row.id);
  if (ids.length === 0) return candidates;

  const rows = await pagedByField(
    TABLES.services,
    "barber",
    ids,
    [Query.equal("active", true)],
  );
  const byBarber = groupBy(rows, (row) => str(row.barber));

  return candidates.filter((candidate) => {
    if (candidate.kind !== "barber") return true;
    const offered = byBarber.get(candidate.id) ?? [];
    if (offered.length === 0) return false;

    candidate.services = offered.map((row) => str(row.name)).filter(Boolean);
    const prices = offered.map((row) => num(row.price)).filter((value) => value > 0);
    candidate.price = prices.length > 0 ? Math.min(...prices) : 0;
    return true;
  });
}

async function shopCandidates(): Promise<Candidate[]> {
  const rows = await paged(
    TABLES.businesses,
    [Query.equal("state", "active"), Query.equal("active", true)],
    300,
    600,
  );
  const businesses = rows.map(toBusiness);
  if (businesses.length === 0) return [];

  const ids = businesses.map((business) => business.id);
  // Staff and menus are each loaded once for every shop, instead of once per
  // shop inside the loop.
  const [staffRows, menuRows] = await Promise.all([
    pagedByField(
      TABLES.barbers,
      "business",
      ids,
      [Query.equal("active", true)],
    ),
    pagedByField(
      TABLES.services,
      "business",
      ids,
      [Query.equal("active", true)],
    ),
  ]);
  const staffByShop = groupBy(staffRows, (row) => str(row.business));
  const menuByShop = groupBy(menuRows, (row) => str(row.business));

  const out: Candidate[] = [];
  for (const business of businesses) {
    const professionals = (staffByShop.get(business.id) ?? [])
      .map(toBarber)
      .filter(isBookable);
    if (professionals.length === 0) continue;

    // The shop's own menu is the union of what its staff can do.
    const menu = menuByShop.get(business.id) ?? [];
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

/**
 * Short-lived cache for the two expensive live checks. Both are keyed by the
 * professional and the shop date (never by visitor or client clock), so the
 * same barber appearing in several feeds costs one availability read. The TTL
 * is deliberately short: a stale slot for a few seconds is preferable to an
 * unbounded scan of the whole marketplace.
 */
const LIVE_TTL = 15_000;
const CACHE_LIMIT = 500;

type Memo<T> = { value: T; expires: number };
type LiveCache<T> = { values: Map<string, Memo<T>>; pending: Map<string, Promise<T>> };

function liveCache<T>(): LiveCache<T> {
  return { values: new Map(), pending: new Map() };
}

function cached<T>(cache: LiveCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.values.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);

  const running = cache.pending.get(key);
  if (running) return running;

  const task = load().then(
    (value) => {
      cache.values.set(key, { value, expires: Date.now() + LIVE_TTL });
      cache.pending.delete(key);
      if (cache.values.size > CACHE_LIMIT) {
        // Map keeps insertion order: drop the oldest entries first.
        for (const old of cache.values.keys()) {
          if (cache.values.size <= CACHE_LIMIT / 2) break;
          cache.values.delete(old);
        }
      }
      return value;
    },
    (error) => {
      cache.pending.delete(key);
      throw error;
    },
  );
  cache.pending.set(key, task);
  return task;
}

const openCache = liveCache<boolean>();
const nextCache = liveCache<{ date: string; start: number } | null>();

/** Whether a professional is taking anyone in right now. */
export async function isOpenNow(barberId: string): Promise<boolean> {
  const date = shopClock().date;
  return cached(openCache, `open|${barberId}|${date}|30`, async () => {
    const slots = await getSlots({ barber: barberId, date, time: 30 });
    return slots.length > 0;
  });
}

async function withNext(
  candidate: Candidate,
  withinDays: number,
): Promise<{ date: string; start: number } | null> {
  const date = shopClock().date;
  return cached(nextCache, `next|${candidate.anchor}|${date}|30|${withinDays}`, async () => {
    const free = await nextFree({
      barber: candidate.anchor,
      time: 30,
      days: withinDays,
    });
    return free ? { date: free.date, start: free.start } : null;
  });
}

/* --------------------------------------------------------------- search */

type NextSlot = { date: string; start: number };
type RankedRow = {
  candidate: Candidate;
  distance: number;
  next?: NextSlot | null;
  open?: boolean;
};

/** Live checks are the expensive part; keep the first window small. */
const SHORTLIST_BUFFER = 12;
/** Hard ceiling so a pathological query still cannot scan the whole city. */
const MAX_LIVE_CHECKS = 96;

export async function search(query: SearchQuery = {}): Promise<SearchResult[]> {
  const type = query.type ?? "all";
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const sort = query.sort ?? "recommended";
  const needle = query.q?.trim() ?? "";
  const within = query.within ?? 7;

  // Pass 1: candidates and their cheap signals. Services, staff, menus and
  // review counts are loaded per collection, not per candidate.
  const candidates: Candidate[] = [];
  if (type === "all" || type === "barber") candidates.push(...(await barberCandidates()));
  if (type === "all" || type === "shop") candidates.push(...(await shopCandidates()));
  await attachIndependentServices(candidates);

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

  // Review counts are one paged query for everybody, not one per result.
  const counts = await reviewCounts(filtered.map((row) => row.reviewTarget));
  const rows: RankedRow[] = filtered.map((candidate) => ({
    candidate,
    distance: origin ? distanceKm(origin, { lat: candidate.lat, lng: candidate.lng }) : 0,
  }));

  const needsLive = query.openNow || sort === "soonest" || !!query.within;

  // Pass 2: order by the cheap signals and shortlist before touching the
  // availability engine. "Soonest" has no static signal of its own, so it is
  // shortlisted by the same recommendation score used by the default feed.
  const preSort = sort === "soonest" ? "recommended" : sort;
  rows.sort((a, b) => compareRows(a, b, preSort, counts, origin));

  let visible: RankedRow[];
  if (!needsLive) {
    visible = rows.slice(0, limit).map((row) => ({ ...row, next: null, open: true }));
  } else {
    const checked: RankedRow[] = [];
    const budget = Math.min(rows.length, Math.max(limit + SHORTLIST_BUFFER, MAX_LIVE_CHECKS));
    let cursor = 0;

    // Expand the shortlist only while live filters leave us short of the
    // requested page size. Most searches stop after the first batch.
    while (cursor < budget && checked.length < limit) {
      const batch = rows.slice(cursor, Math.min(cursor + SHORTLIST_BUFFER, budget));
      const results = await Promise.all(
        batch.map(async (row) => {
          const next = await withNext(row.candidate, within);
          const open = query.openNow ? await isOpenNow(row.candidate.anchor) : true;
          return { ...row, next, open };
        }),
      );
      for (const row of results) {
        if (query.openNow && !row.open) continue;
        if (query.within && !row.next) continue;
        checked.push(row);
      }
      cursor = Math.min(cursor + SHORTLIST_BUFFER, budget);
    }

    checked.sort((a, b) => compareRows(a, b, sort, counts, origin));
    visible = checked.slice(0, limit);
  }

  return visible.map((row) => ({
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
    next: row.next ?? null,
    openNow: row.open ?? true,
    slug: row.candidate.slug,
  }));
}

function compareRows(
  a: RankedRow,
  b: RankedRow,
  sort: SortKey,
  counts: Map<string, number>,
  origin: { lat: number; lng: number } | null,
): number {
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
      return compareNext(a.next ?? null, b.next ?? null);
    case "recommended":
    default:
      return recommend(a, b, counts, origin);
  }
}

function compareNext(a: NextSlot | null, b: NextSlot | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.start - b.start;
}

/**
 * Recommended order: real signal only — rating, how many people reviewed,
 * whether they can see you soon, and distance when we know where you are.
 * `next` is absent during the cheap pre-sort, so its bonus is simply skipped
 * until the shortlisted rows have been checked. Nothing here is paid for.
 */
function recommend(
  a: RankedRow,
  b: RankedRow,
  reviews: Map<string, number>,
  origin: { lat: number; lng: number } | null,
): number {
  const score = (row: RankedRow): number => {
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

  // Page instead of a 500-row cap: a busy professional must not lose reviews
  // (and therefore ranking signal) just because the first page filled up.
  const rows = await pagedByField(
    TABLES.reviews,
    "barber",
    unique,
    [Query.equal("state", "open")],
    200,
    4000,
  );

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
