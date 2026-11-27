import "server-only";

import { Query } from "node-appwrite";
import { cache } from "react";

import { TABLES } from "@/lib/appwrite/db";

import { bool, clean, create, first, get, list, num, str, update, type Row } from "./crud";
import type { Branch, Business } from "./types";

const SIZES = {
  name: 64,
  slug: 64,
  logo: 512,
  cover: 512,
  about: 1024,
  phone: 32,
  city: 64,
  district: 64,
  address: 160,
  facilities: 256,
  policy: 512,
  web: 128,
  note: 256,
};

export function toBusiness(row: Row): Business {
  const state = str(row.state, "draft");
  return {
    id: row.$id,
    owner: str(row.owner),
    name: str(row.name),
    slug: str(row.slug),
    logo: str(row.logo),
    cover: str(row.cover),
    about: str(row.about),
    phone: str(row.phone),
    city: str(row.city, "Tashkent"),
    district: str(row.district),
    address: str(row.address),
    lat: num(row.lat),
    lng: num(row.lng),
    facilities: str(row.facilities),
    policy: str(row.policy),
    web: str(row.web),
    confirm: bool(row.confirm, true),
    state:
      state === "review" || state === "active" || state === "suspended"
        ? state
        : "draft",
    verified: bool(row.verified),
    active: bool(row.active, true),
    plan: str(row.plan, "free"),
    rating: num(row.rating),
    seats: num(row.seats),
    buffer: num(row.buffer),
    step: num(row.step, 15) || 15,
    views: num(row.views),
  };
}

export function toBranch(row: Row): Branch {
  return {
    id: row.$id,
    business: str(row.business),
    name: str(row.name),
    slug: str(row.slug),
    phone: str(row.phone),
    city: str(row.city, "Tashkent"),
    district: str(row.district),
    address: str(row.address),
    lat: num(row.lat),
    lng: num(row.lng),
    note: str(row.note),
    active: bool(row.active, true),
    primary: bool(row.primary),
    sort: num(row.sort),
  };
}

/** Published and taking bookings — the state customers are allowed to see. */
export function isPublic(business: Business): boolean {
  return business.state === "active" && business.active;
}

/* -------------------------------------------------------------- businesses */

export const getBusiness = cache(async (id: string): Promise<Business | null> => {
  const row = await get(TABLES.businesses, id);
  return row ? toBusiness(row) : null;
});

export async function businessesFor(ownerId: string): Promise<Business[]> {
  const rows = await list(TABLES.businesses, [
    Query.equal("owner", ownerId),
    Query.limit(20),
  ]);
  return rows.map(toBusiness);
}

export async function businessBySlug(slug: string): Promise<Business | null> {
  if (!slug) return null;
  const row = await first(TABLES.businesses, [Query.equal("slug", slug)]);
  return row ? toBusiness(row) : null;
}

export async function createBusiness(input: {
  owner: string;
  name: string;
  city?: string;
  phone?: string;
  confirm?: boolean;
}): Promise<Business> {
  const name = clean(input.name, SIZES.name);
  const row = await create(TABLES.businesses, {
    owner: input.owner,
    name,
    slug: await uniqueBusinessSlug(name),
    logo: "",
    cover: "",
    about: "",
    phone: clean(input.phone, SIZES.phone),
    city: clean(input.city, SIZES.city) || "Tashkent",
    district: "",
    address: "",
    lat: 0,
    lng: 0,
    facilities: "",
    policy: "",
    web: "",
    confirm: input.confirm ?? true,
    state: "draft",
    verified: false,
    active: true,
    plan: "free",
    rating: 0,
    seats: 0,
    buffer: 0,
    step: 15,
    views: 0,
  });
  return toBusiness(row);
}

export async function updateBusiness(
  id: string,
  patch: Partial<Business>,
): Promise<Business> {
  const data: Record<string, unknown> = {};

  const setText = (key: keyof Business, size: number) => {
    if (typeof patch[key] === "string") data[key] = clean(patch[key], size);
  };

  setText("name", SIZES.name);
  setText("slug", SIZES.slug);
  setText("logo", SIZES.logo);
  setText("cover", SIZES.cover);
  setText("about", SIZES.about);
  setText("phone", SIZES.phone);
  setText("city", SIZES.city);
  setText("district", SIZES.district);
  setText("address", SIZES.address);
  setText("facilities", SIZES.facilities);
  setText("policy", SIZES.policy);
  setText("web", SIZES.web);

  if (typeof patch.lat === "number") data.lat = patch.lat;
  if (typeof patch.lng === "number") data.lng = patch.lng;
  if (typeof patch.confirm === "boolean") data.confirm = patch.confirm;
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.verified === "boolean") data.verified = patch.verified;
  if (typeof patch.state === "string") data.state = patch.state;
  if (typeof patch.seats === "number") {
    data.seats = Math.min(200, Math.max(0, Math.round(patch.seats)));
  }
  if (typeof patch.buffer === "number") {
    data.buffer = Math.min(120, Math.max(0, Math.round(patch.buffer)));
  }
  if (typeof patch.step === "number") {
    data.step = Math.min(60, Math.max(5, Math.round(patch.step)));
  }

  const row = await update(TABLES.businesses, id, data);
  return toBusiness(row);
}

/** Appending a counter keeps a taken slug unique without a second index. */
async function uniqueBusinessSlug(name: string): Promise<string> {
  const base = clean(name, SIZES.slug)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "shop";

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await first(TABLES.businesses, [Query.equal("slug", candidate)]);
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ---------------------------------------------------------------- branches */

/** Every branch of a business, the primary one first. */
export const listBranches = cache(
  async (businessId: string): Promise<Branch[]> => {
    const rows = await list(TABLES.branches, [
      Query.equal("business", businessId),
      Query.limit(100),
    ]);
    const branches = rows.map(toBranch).sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      return a.sort - b.sort || a.name.localeCompare(b.name);
    });
    return branches;
  },
);

export async function getBranch(id: string): Promise<Branch | null> {
  const row = await get(TABLES.branches, id);
  return row ? toBranch(row) : null;
}

export async function activeBranches(businessId: string): Promise<Branch[]> {
  return (await listBranches(businessId)).filter((row) => row.active);
}

export async function createBranch(input: {
  business: string;
  name: string;
  city?: string;
  primary?: boolean;
}): Promise<Branch> {
  const existing = await listBranches(input.business);
  const row = await create(TABLES.branches, {
    business: input.business,
    name: clean(input.name, SIZES.name) || "Main",
    slug: "",
    phone: "",
    city: clean(input.city, SIZES.city) || "Tashkent",
    district: "",
    address: "",
    lat: 0,
    lng: 0,
    note: "",
    active: true,
    primary: input.primary ?? existing.length === 0,
    sort: existing.length,
  });
  return toBranch(row);
}

export async function updateBranch(
  id: string,
  patch: Partial<Branch>,
): Promise<Branch> {
  const data: Record<string, unknown> = {};

  if (typeof patch.name === "string") data.name = clean(patch.name, SIZES.name);
  if (typeof patch.phone === "string") data.phone = clean(patch.phone, SIZES.phone);
  if (typeof patch.city === "string") data.city = clean(patch.city, SIZES.city);
  if (typeof patch.district === "string") data.district = clean(patch.district, SIZES.district);
  if (typeof patch.address === "string") data.address = clean(patch.address, SIZES.address);
  if (typeof patch.note === "string") data.note = clean(patch.note, SIZES.note);
  if (typeof patch.lat === "number") data.lat = patch.lat;
  if (typeof patch.lng === "number") data.lng = patch.lng;
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.primary === "boolean") data.primary = patch.primary;
  if (typeof patch.sort === "number") data.sort = patch.sort;

  const row = await update(TABLES.branches, id, data);
  return toBranch(row);
}

/** Promote a branch to the one shown first. Only one can hold the flag. */
export async function makePrimary(businessId: string, branchId: string): Promise<void> {
  const branches = await listBranches(businessId);
  await Promise.all(
    branches.map((branch) =>
      update(TABLES.branches, branch.id, { primary: branch.id === branchId }),
    ),
  );
}

/**
 * Close a branch for good. Employees and history stay exactly where they
 * are: a branch only stops accepting new bookings.
 */
export async function closeBranch(id: string): Promise<void> {
  await update(TABLES.branches, id, { active: false, primary: false });
}

/** Staff assigned to a branch. */
export async function branchStaff(branchId: string): Promise<string[]> {
  const rows = await list(TABLES.memberships, [
    Query.equal("branch", branchId),
    Query.equal("state", "active"),
    Query.limit(100),
  ]);
  return rows.map((row) => str(row.barber)).filter(Boolean);
}

/** The branch an employee defaults to, falling back to the business' first. */
export async function defaultBranch(businessId: string, barberId: string): Promise<string> {
  const staff = await list(TABLES.memberships, [
    Query.equal("business", businessId),
    Query.limit(100),
  ]);
  const mine = staff.find((row) => str(row.barber) === barberId);
  const assigned = str(mine?.branch);
  if (assigned) return assigned;

  const branches = await activeBranches(businessId);
  return branches[0]?.id ?? "";
}
