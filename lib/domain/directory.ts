import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, getMany, list, num, str, type Row } from "./crud";
import { toBranch, toBusiness } from "./business";
import type { Branch, Business, Place } from "./types";

/**
 * Batch resolvers.
 *
 * Views that render a list must never issue one query per row, so every
 * lookup a table of appointments needs is collected here and answered in a
 * fixed number of requests.
 */

export async function getBusinessesSafe(ids: string[]): Promise<Map<string, Business>> {
  if (ids.length === 0) return new Map();
  const rows = await getMany(TABLES.businesses, ids);
  return new Map(rows.map((row) => [row.$id, toBusiness(row)]));
}

export async function getBranchesSafe(ids: string[]): Promise<Map<string, Branch>> {
  if (ids.length === 0) return new Map();
  const rows = await getMany(TABLES.branches, ids);
  return new Map(rows.map((row) => [row.$id, toBranch(row)]));
}

/* ---------------------------------------------------------------- places */

export function toPlace(row: Row): Place {
  return {
    id: row.$id,
    name: str(row.name),
    ru: str(row.ru),
    en: str(row.en),
    kind: str(row.kind, "city") === "district" ? "district" : "city",
    parent: str(row.parent),
    lat: num(row.lat),
    lng: num(row.lng),
    sort: num(row.sort),
    active: bool(row.active, true),
  };
}

/** Every active city, districts grouped under their parent. */
export async function loadPlaces(): Promise<{
  cities: Place[];
  districts: Place[];
  byId: Map<string, Place>;
}> {
  const rows = await list(TABLES.places, [
    Query.equal("active", true),
    Query.orderAsc("sort"),
    Query.orderAsc("name"),
    Query.limit(300),
  ]);

  const all = rows.map(toPlace);
  return {
    cities: all.filter((place) => place.kind === "city"),
    districts: all.filter((place) => place.kind === "district"),
    byId: new Map(all.map((place) => [place.id, place])),
  };
}

export async function getPlace(id: string): Promise<Place | null> {
  const rows = await getMany(TABLES.places, [id]);
  return rows.length > 0 ? toPlace(rows[0]) : null;
}

/**
 * Which district a place id refers to, resolving the parent city.
 * Coordinates fall back to the city centre when a district has none.
 */
export async function placeLabel(id: string): Promise<{ city: string; district: string }> {
  if (!id) return { city: "", district: "" };
  const place = await getPlace(id);
  if (!place) return { city: "", district: "" };

  if (place.kind === "city") return { city: place.name, district: "" };

  const parent = place.parent ? await getPlace(place.parent) : null;
  return { city: parent?.name ?? "Tashkent", district: place.name };
}

export async function placeCenter(id: string): Promise<{ lat: number; lng: number }> {
  const place = await getPlace(id);
  if (!place) return { lat: 0, lng: 0 };
  if (place.lat || place.lng) return { lat: place.lat, lng: place.lng };

  const parent = place.kind === "district" && place.parent ? await getPlace(place.parent) : null;
  return { lat: parent?.lat ?? place.lat, lng: parent?.lng ?? place.lng };
}

/* -------------------------------------------------------------- categories */

export type Category = { id: string; name: string };

export async function loadCategories(): Promise<Category[]> {
  const rows = await list(TABLES.categories, [
    Query.equal("active", true),
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return rows.map((row) => ({ id: row.$id, name: str(row.name) })).filter((row) => row.name);
}

/* ------------------------------------------------------------- formatting */

/** Uzbek phone numbers are written +998 XX XXX XX XX. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length !== 9) return value;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** Straight-line distance in kilometres, good enough for "nearby". */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** "1.2 km" away, or nothing when we have no coordinates. */
export function distanceLabel(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const km = distanceKm(from, to);
  if (!km) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
}
