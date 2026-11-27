import "server-only";

import { Query } from "node-appwrite";
import { cache } from "react";

import { TABLES } from "@/lib/appwrite/db";

import {
  bool,
  clean,
  create,
  first,
  get,
  getMany,
  json,
  list,
  num,
  str,
  update,
  type Row,
} from "./crud";
import type { Barber, Locale, ProState } from "./types";

/** A barber document, mapped. The row itself is only used inside this file. */
export type BarberRow = Barber;

const SIZES = {
  name: 64,
  title: 64,
  slug: 64,
  bio: 1024,
  photo: 512,
  cover: 512,
  shop: 64,
  address: 160,
  city: 64,
  district: 64,
  skills: 256,
  langs: 64,
  phone: 32,
  social: 256,
  facilities: 256,
  policy: 512,
};

export function toBarber(row: Row): BarberRow {
  const state = str(row.state, "active");
  return {
    id: row.$id,
    user: str(row.user),
    business: str(row.business),
    branch: str(row.branch),
    name: str(row.name),
    title: str(row.title),
    slug: str(row.slug),
    bio: str(row.bio),
    photo: str(row.photo),
    cover: str(row.cover),
    rating: num(row.rating),
    active: bool(row.active, true),
    state: (state === "draft" || state === "suspended" ? state : "active") as ProState,
    verified: bool(row.verified),
    featured: bool(row.featured),
    shop: str(row.shop),
    address: str(row.address),
    city: str(row.city, "Tashkent"),
    district: str(row.district),
    lat: num(row.lat),
    lng: num(row.lng),
    years: num(row.years),
    skills: str(row.skills),
    langs: str(row.langs),
    phone: str(row.phone),
    social: str(row.social),
    facilities: str(row.facilities),
    policy: str(row.policy),
    confirm: bool(row.confirm),
    buffer: num(row.buffer),
    step: num(row.step, 15) || 15,
    views: num(row.views),
  };
}

/** Publicly bookable: approved, switched on and not suspended. */
export function isBookable(barber: BarberRow): boolean {
  return barber.active && barber.state === "active";
}

/* ------------------------------------------------------------------- reads */

export const getBarber = cache(async (id: string): Promise<BarberRow | null> => {
  const row = await get(TABLES.barbers, id);
  return row ? toBarber(row) : null;
});

/** Resolve several professionals in one request, keyed by id. */
export async function getBarbers(ids: string[]): Promise<Map<string, BarberRow>> {
  const rows = await getMany(TABLES.barbers, ids);
  return new Map(rows.map((row) => [row.$id, toBarber(row)]));
}

export const barberForUser = cache(
  async (userId: string): Promise<BarberRow | null> => {
    const row = await first(TABLES.barbers, [Query.equal("user", userId)]);
    return row ? toBarber(row) : null;
  },
);

/** Every professional row belonging to one account (rare, but legal). */
export async function barbersForUser(userId: string): Promise<BarberRow[]> {
  const rows = await list(TABLES.barbers, [Query.equal("user", userId)]);
  return rows.map(toBarber);
}

export async function listBarbers(
  queries: string[] = [],
  limit = 100,
): Promise<BarberRow[]> {
  // Legacy rows were written before `state` existed and have a null value.
  // `toBarber` treats those as active, so filter after mapping instead of
  // excluding them with a database-level equality query.
  const rows = await list(TABLES.barbers, [
    Query.equal("active", true),
    ...queries,
    Query.limit(limit),
  ]);
  return rows.map(toBarber).filter((row) => row.state === "active");
}

export async function listBusinessBarbers(businessId: string): Promise<BarberRow[]> {
  const rows = await list(TABLES.barbers, [
    Query.equal("business", businessId),
    Query.orderAsc("name"),
    Query.limit(100),
  ]);
  return rows.map(toBarber);
}

/* ------------------------------------------------------------------ writes */

export type BarberSeed = Partial<Barber> & { user: string };

/**
 * Create the professional row for an approved account. Approval is not
 * atomic, so a promoted barber can be missing their row: every workspace
 * entry point calls this to repair the link instead of showing a dead shell.
 */
export async function ensureBarber(
  userId: string,
  seed: Partial<Barber> = {},
): Promise<BarberRow> {
  const existing = await barberForUser(userId);
  if (existing) return existing;

  const name = clean(seed.name, SIZES.name) || "Barber";

  const row = await createBarber({
    ...seed,
    user: userId,
    name,
    city: seed.city || "Tashkent",
    phone: seed.phone || "",
  });
  return row;
}

export async function createBarber(data: BarberSeed): Promise<BarberRow> {
  const row = await create(TABLES.barbers, {
    user: data.user,
    business: data.business ?? "",
    branch: data.branch ?? "",
    name: clean(data.name, SIZES.name) || "Barber",
    title: clean(data.title, SIZES.title),
    slug: clean(data.slug, SIZES.slug),
    bio: clean(data.bio, SIZES.bio),
    photo: clean(data.photo, SIZES.photo),
    cover: clean(data.cover, SIZES.cover),
    shop: clean(data.shop, SIZES.shop),
    address: clean(data.address, SIZES.address),
    city: clean(data.city, SIZES.city) || "Tashkent",
    district: clean(data.district, SIZES.district),
    lat: data.lat ?? 0,
    lng: data.lng ?? 0,
    years: Math.min(80, Math.max(0, data.years ?? 0)),
    skills: clean(data.skills, SIZES.skills),
    langs: clean(data.langs, SIZES.langs),
    phone: clean(data.phone, SIZES.phone),
    social: clean(data.social, SIZES.social),
    facilities: clean(data.facilities, SIZES.facilities),
    policy: clean(data.policy, SIZES.policy),
    confirm: data.confirm ?? false,
    buffer: Math.min(120, Math.max(0, data.buffer ?? 0)),
    step: data.step ?? 15,
    rating: 0,
    active: true,
    state: data.state ?? "active",
    verified: false,
    featured: false,
    views: 0,
  });
  return toBarber(row);
}

/** Patch a professional row. Unknown keys are ignored on purpose. */
export async function updateBarber(
  id: string,
  patch: Partial<Barber>,
): Promise<BarberRow> {
  const data: Record<string, unknown> = {};

  const setText = (key: keyof Barber, size: number) => {
    if (typeof patch[key] === "string") data[key] = clean(patch[key], size);
  };

  setText("name", SIZES.name);
  setText("title", SIZES.title);
  setText("slug", SIZES.slug);
  setText("bio", SIZES.bio);
  setText("photo", SIZES.photo);
  setText("cover", SIZES.cover);
  setText("shop", SIZES.shop);
  setText("address", SIZES.address);
  setText("city", SIZES.city);
  setText("district", SIZES.district);
  setText("skills", SIZES.skills);
  setText("phone", SIZES.phone);
  setText("social", SIZES.social);
  setText("facilities", SIZES.facilities);
  setText("policy", SIZES.policy);

  if (typeof patch.langs === "string") data.langs = clean(patch.langs, SIZES.langs);
  if (typeof patch.lat === "number") data.lat = patch.lat;
  if (typeof patch.lng === "number") data.lng = patch.lng;
  if (typeof patch.years === "number") {
    data.years = Math.min(80, Math.max(0, Math.round(patch.years)));
  }
  if (typeof patch.confirm === "boolean") data.confirm = patch.confirm;
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.verified === "boolean") data.verified = patch.verified;
  if (typeof patch.featured === "boolean") data.featured = patch.featured;
  if (typeof patch.buffer === "number") {
    data.buffer = Math.min(120, Math.max(0, Math.round(patch.buffer)));
  }
  if (typeof patch.step === "number") {
    data.step = Math.min(60, Math.max(5, Math.round(patch.step)));
  }
  if (typeof patch.state === "string") data.state = patch.state;
  if (typeof patch.business === "string") data.business = patch.business;
  if (typeof patch.branch === "string") data.branch = patch.branch;

  const row = await update(TABLES.barbers, id, data);
  return toBarber(row);
}

/** Record one profile view. Best effort — a failed count never breaks a page. */
export async function countView(id: string): Promise<void> {
  try {
    const row = await get(TABLES.barbers, id);
    if (!row) return;
    await update(TABLES.barbers, id, { views: num(row.views) + 1 });
  } catch (error) {
    console.error("[domain] view count failed", error);
  }
}

/** Recompute the cached average from a professional's visible reviews. */
export async function setRating(id: string, rating: number): Promise<void> {
  await update(TABLES.barbers, id, { rating: Math.round(rating * 10) / 10 });
}

/** Skills are stored as a comma-separated string; read them as a list. */
export function parsedSkills(barber: BarberRow): string[] {
  const fromJson = json<string[] | string>(barber.skills, []);
  if (Array.isArray(fromJson)) return fromJson.map((item) => String(item).trim()).filter(Boolean);
  return barber.skills
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Languages the professional can serve a client in, as a list. */
export function parsedLangs(barber: BarberRow): Locale[] {
  const allowed: Locale[] = ["uz", "ru", "en"];
  return barber.langs
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is Locale => (allowed as string[]).includes(item));
}
