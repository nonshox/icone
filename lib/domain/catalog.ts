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
  list,
  num,
  remove,
  str,
  update,
  type Row,
} from "./crud";
import { applyOffer, listOffers, offerFor } from "./offers";
import type { EmployeeService, OfferedService, Service } from "./types";

const SIZES = { name: 64, note: 256, image: 512, category: 32 };

export function toService(row: Row): Service {
  return {
    id: row.$id,
    barber: str(row.barber),
    business: str(row.business),
    name: str(row.name),
    note: str(row.note),
    price: num(row.price),
    time: num(row.time, 30) || 30,
    buffer: num(row.buffer),
    active: bool(row.active, true),
    image: str(row.image),
    category: str(row.category, "Hair"),
    featured: bool(row.featured),
    sort: num(row.sort),
  };
}

export function toEmployeeService(row: Row): EmployeeService {
  return {
    id: row.$id,
    business: str(row.business),
    barber: str(row.barber),
    service: str(row.service),
    price: num(row.price, -1),
    time: num(row.time, -1),
    active: bool(row.active, true),
    sort: num(row.sort),
  };
}

/* ----------------------------------------------------------------- reads */

export const getService = cache(async (id: string): Promise<Service | null> => {
  const row = await get(TABLES.services, id);
  return row ? toService(row) : null;
});

/** An independent barber's own menu. */
export async function listBarberServices(
  barberId: string,
  includeInactive = false,
): Promise<Service[]> {
  const queries = [Query.equal("barber", barberId)];
  if (!includeInactive) queries.push(Query.equal("active", true));

  const rows = await list(TABLES.services, [...queries, Query.orderAsc("sort"), Query.limit(100)]);
  return rows.map(toService);
}

/** A business's shared catalogue. */
export async function listBusinessServices(
  businessId: string,
  includeInactive = false,
): Promise<Service[]> {
  const queries = [Query.equal("business", businessId)];
  if (!includeInactive) queries.push(Query.equal("active", true));

  const rows = await list(TABLES.services, [...queries, Query.orderAsc("sort"), Query.limit(200)]);
  return rows.map(toService);
}

export async function listEmployeeServices(barberId: string): Promise<EmployeeService[]> {
  const rows = await list(TABLES.empser, [
    Query.equal("barber", barberId),
    Query.limit(200),
  ]);
  return rows.map(toEmployeeService);
}

/**
 * Everything one professional actually offers, with the price and duration
 * the customer will be charged.
 *
 * Independent barber → their own menu, every item assigned by definition.
 * Shop employee → the shared catalogue filtered by assignment, with any
 * per-employee price or duration override applied.
 */
export async function servicesForBase(barberId: string): Promise<OfferedService[]> {
  const sample = await first(TABLES.barbers, [Query.equal("$id", barberId)]);
  if (!sample) return [];

  const business = str(sample.business);

  if (!business) {
    const own = await listBarberServices(barberId);
    return own.map((service) => ({
      ...service,
      ownPrice: service.price,
      ownTime: service.time,
      assigned: true,
    }));
  }

  const [catalogue, overrides] = await Promise.all([
    listBusinessServices(business),
    listEmployeeServices(barberId),
  ]);

  const byService = new Map(overrides.map((row) => [row.service, row]));

  return catalogue
    .filter((service) => {
      const override = byService.get(service.id);
      // Unassigned by default: an employee must be given each service.
      return override ? override.active : false;
    })
    .map((service) => {
      const override = byService.get(service.id);
      const price = override && override.price >= 0 ? override.price : service.price;
      const time = override && override.time >= 0 ? override.time : service.time;
      return {
        ...service,
        price,
        time,
        ownPrice: price,
        ownTime: time,
        assigned: true,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

/**
 * The public read path. Materialised `offers` rows win on price, duration and
 * assignment; the calculation above still supplies the catalogue metadata and
 * covers every service that has not been backfilled yet. The returned shape is
 * identical to `servicesForBase`, so callers need no changes.
 */
export async function servicesFor(barberId: string): Promise<OfferedService[]> {
  const [base, offers] = await Promise.all([
    servicesForBase(barberId),
    listOffers(barberId),
  ]);
  if (offers.length === 0) return base;

  const active = new Map(offers.filter((row) => row.active).map((row) => [row.service, row]));
  const inactive = new Set(offers.filter((row) => !row.active).map((row) => row.service));

  return base
    .filter((service) => !inactive.has(service.id))
    .map((service) => {
      const offer = active.get(service.id);
      return offer ? applyOffer(offer, service) : service;
    });
}

/** The catalogue services one employee is missing — used by the assign UI. */
export async function unassignedServices(
  businessId: string,
  barberId: string,
): Promise<Service[]> {
  const [catalogue, assigned] = await Promise.all([
    listBusinessServices(businessId),
    listEmployeeServices(barberId),
  ]);
  const taken = new Set(assigned.map((row) => row.service));
  return catalogue.filter((service) => !taken.has(service.id));
}

/**
 * Can this professional perform this service for a booking?
 *
 * Deleted and deactivated services are never bookable, and a shared service
 * is only offered by the employees it is assigned to.
 */
export async function canPerform(barberId: string, serviceId: string): Promise<boolean> {
  const offered = await servicesFor(barberId);
  return offered.some((service) => service.id === serviceId && service.active);
}

/**
 * The legacy calculation for one service, used as the fallback when no offer
 * row exists. Kept separate so `offers.ts` can fall back without recursing.
 */
export async function resolveOfferBase(
  barberId: string,
  serviceId: string,
): Promise<OfferedService | null> {
  const offered = await servicesForBase(barberId);
  return offered.find((service) => service.id === serviceId) ?? null;
}

/** The row a booking should charge, resolved for one employee. */
export async function resolveOffer(
  barberId: string,
  serviceId: string,
): Promise<OfferedService | null> {
  return offerFor(barberId, serviceId);
}

/** Every service id an employee can perform, for the availability engine. */
export async function performedIds(barberId: string): Promise<Set<string>> {
  return new Set((await servicesFor(barberId)).map((service) => service.id));
}

/* ---------------------------------------------------------------- writes */

export async function createService(input: {
  name: string;
  price: number;
  time: number;
  barber?: string;
  business?: string;
  note?: string;
  category?: string;
  buffer?: number;
  sort?: number;
}): Promise<Service> {
  const ownerBarber = input.barber ?? "";
  const ownerBusiness = input.business ?? "";

  if (!ownerBarber && !ownerBusiness) throw new Error("service_needs_owner");

  const row = await create(TABLES.services, {
    name: clean(input.name, SIZES.name) || "Service",
    note: clean(input.note ?? "", SIZES.note),
    price: Math.max(0, Math.round(input.price)),
    time: Math.min(480, Math.max(5, Math.round(input.time))),
    buffer: Math.min(120, Math.max(0, Math.round(input.buffer ?? 0))),
    active: true,
    image: "",
    category: clean(input.category ?? "Hair", SIZES.category) || "Hair",
    featured: false,
    discount: 0,
    barber: ownerBarber,
    business: ownerBusiness,
    sort: input.sort ?? 0,
  });
  return toService(row);
}

export async function updateService(
  id: string,
  patch: Partial<Service>,
): Promise<Service> {
  const data: Record<string, unknown> = {};

  if (typeof patch.name === "string") data.name = clean(patch.name, SIZES.name);
  if (typeof patch.note === "string") data.note = clean(patch.note, SIZES.note);
  if (typeof patch.image === "string") data.image = clean(patch.image, SIZES.image);
  if (typeof patch.category === "string") data.category = clean(patch.category, SIZES.category);
  if (typeof patch.price === "number") data.price = Math.max(0, Math.round(patch.price));
  if (typeof patch.time === "number") {
    data.time = Math.min(480, Math.max(5, Math.round(patch.time)));
  }
  if (typeof patch.buffer === "number") {
    data.buffer = Math.min(120, Math.max(0, Math.round(patch.buffer)));
  }
  if (typeof patch.sort === "number") data.sort = Math.min(999, Math.max(0, patch.sort));
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.featured === "boolean") data.featured = patch.featured;

  const row = await update(TABLES.services, id, data);
  return toService(row);
}

/**
 * Retire a service. It is deactivated rather than deleted so past
 * appointments keep the name and price they were booked at.
 */
export async function retireService(id: string): Promise<void> {
  await update(TABLES.services, id, { active: false, featured: false });
}

/* --------------------------------------------------- employee assignment */

export async function assignService(input: {
  business: string;
  barber: string;
  service: string;
  price?: number;
  time?: number;
}): Promise<EmployeeService> {
  const existing = await first(TABLES.empser, [
    Query.equal("barber", input.barber),
    Query.equal("service", input.service),
  ]);

  const data = {
    business: input.business,
    barber: input.barber,
    service: input.service,
    price: typeof input.price === "number" ? Math.max(-1, Math.round(input.price)) : -1,
    time: typeof input.time === "number" ? Math.max(-1, Math.round(input.time)) : -1,
    active: true,
    sort: 0,
  };

  const row = existing
    ? await update(TABLES.empser, existing.$id, data)
    : await create(TABLES.empser, data);

  return toEmployeeService(row);
}

export async function setEmployeeService(
  id: string,
  patch: { active?: boolean; price?: number; time?: number; sort?: number },
): Promise<EmployeeService> {
  const data: Record<string, unknown> = {};
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.price === "number") data.price = Math.max(-1, Math.round(patch.price));
  if (typeof patch.time === "number") data.time = Math.max(-1, Math.round(patch.time));
  if (typeof patch.sort === "number") data.sort = Math.min(999, Math.max(0, patch.sort));

  const row = await update(TABLES.empser, id, data);
  return toEmployeeService(row);
}

export async function unassignService(id: string): Promise<void> {
  await remove(TABLES.empser, id);
}

/** Give a new employee the whole catalogue at catalogue prices. */
export async function assignAllServices(
  businessId: string,
  barberId: string,
): Promise<number> {
  const catalogue = await listBusinessServices(businessId);
  const existing = await listEmployeeServices(barberId);
  const taken = new Set(existing.map((row) => row.service));

  const missing = catalogue.filter((service) => !taken.has(service.id));
  await Promise.all(
    missing.map((service) =>
      create(TABLES.empser, {
        business: businessId,
        barber: barberId,
        service: service.id,
        price: -1,
        time: -1,
        active: true,
        sort: service.sort,
      }),
    ),
  );
  return missing.length;
}

export async function categories(): Promise<string[]> {
  const rows = await list(TABLES.categories, [
    Query.equal("active", true),
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return rows.map((row) => str(row.name)).filter(Boolean);
}
