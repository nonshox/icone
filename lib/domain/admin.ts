import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";

import type { Barber, Service } from "./types";

type Row = Models.Document & Record<string, unknown>;

/** A chair with its linked staff account, including inactive chairs. */
export type AdminBarber = Barber & { user: string };

/** One weekly opening window (0 = Sunday … 6 = Saturday). */
export type Hour = {
  id: string;
  barber: string;
  day: number;
  start: number;
  end: number;
};

/** A one-off override for a chair on a date. */
export type DayOverride = {
  id: string;
  barber: string;
  date: string;
  open: boolean;
  start: number;
  end: number;
  note: string;
};

export type AdminReview = {
  id: string;
  user: string;
  barber: string;
  booking: string;
  rate: number;
  note: string;
  created: string;
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toAdminBarber(row: Row): AdminBarber {
  return {
    id: row.$id,
    name: str(row.name),
    title: str(row.title),
    bio: str(row.bio),
    photo: str(row.photo),
    rating: num(row.rating),
    active: bool(row.active, true),
    user: str(row.user),
  };
}

function toService(row: Row): Service {
  return {
    id: row.$id,
    name: str(row.name),
    note: str(row.note),
    price: num(row.price),
    time: num(row.time, 30),
    active: bool(row.active, true),
  };
}

function toHour(row: Row): Hour {
  return {
    id: row.$id,
    barber: str(row.barber),
    day: num(row.day),
    start: num(row.start),
    end: num(row.end),
  };
}

function toDay(row: Row): DayOverride {
  return {
    id: row.$id,
    barber: str(row.barber),
    date: str(row.date),
    open: bool(row.open),
    start: num(row.start),
    end: num(row.end),
    note: str(row.note),
  };
}

function toAdminReview(row: Row): AdminReview {
  return {
    id: row.$id,
    user: str(row.user),
    barber: str(row.barber),
    booking: str(row.booking),
    rate: num(row.rate, 5),
    note: str(row.note),
    created: row.$createdAt,
  };
}

async function list(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

async function get(table: string, id: string): Promise<Row | null> {
  try {
    return await adminDb().getDocument({
      databaseId: databaseId(),
      collectionId: table,
      documentId: id,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

async function remove(table: string, id: string): Promise<void> {
  try {
    await adminDb().deleteDocument({
      databaseId: databaseId(),
      collectionId: table,
      documentId: id,
    });
  } catch (error) {
    // Removing an already-gone row is fine — admin actions are idempotent.
    if (!(error instanceof AppwriteException && error.code === 404)) throw error;
  }
}

/* ------------------------------------------------------------------ reads */

/** Every chair, active or not, for the admin catalogue. */
export async function listAllBarbers(): Promise<AdminBarber[]> {
  const rows = await list(TABLES.barbers, [
    Query.orderAsc("name"),
    Query.limit(100),
  ]);
  return rows.map(toAdminBarber);
}

/** Every service, active or not. */
export async function listAllServices(): Promise<Service[]> {
  const rows = await list(TABLES.services, [
    Query.orderAsc("name"),
    Query.limit(100),
  ]);
  return rows.map(toService);
}

/** All weekly hours across every chair. */
export async function listAllHours(): Promise<Hour[]> {
  const rows = await list(TABLES.hours, [Query.limit(100)]);
  return rows
    .map(toHour)
    .sort((a, b) =>
      a.barber === b.barber ? a.day - b.day : a.barber < b.barber ? -1 : 1,
    );
}

/** All date overrides across every chair. */
export async function listAllDays(): Promise<DayOverride[]> {
  const rows = await list(TABLES.days, [Query.limit(100)]);
  return rows
    .map(toDay)
    .sort((a, b) =>
      a.barber === b.barber
        ? a.date < b.date
          ? -1
          : a.date > b.date
            ? 1
            : 0
        : a.barber < b.barber
          ? -1
          : 1,
    );
}

/** Used by write paths to confirm a chair still exists. */
export async function findBarber(id: string): Promise<AdminBarber | null> {
  const row = await get(TABLES.barbers, id);
  return row ? toAdminBarber(row) : null;
}

/** Every review, newest first, for moderation. */
export async function listAllReviews(): Promise<AdminReview[]> {
  const rows = await list(TABLES.reviews, [
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return rows.map(toAdminReview);
}

/* ----------------------------------------------------------------- writes */

export async function createBarber(input: {
  name: string;
  title: string;
  bio: string;
}): Promise<AdminBarber> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: ID.unique(),
    data: { ...input, photo: "", rating: 0, active: true, user: "" },
  });
  return toAdminBarber(row as Row);
}

export async function setBarberActive(
  id: string,
  active: boolean,
): Promise<AdminBarber> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: id,
    data: { active },
  });
  return toAdminBarber(row as Row);
}

export async function createService(input: {
  name: string;
  note: string;
  price: number;
  time: number;
}): Promise<Service> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: ID.unique(),
    data: { ...input, active: true },
  });
  return toService(row as Row);
}

export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<Service> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: id,
    data: { active },
  });
  return toService(row as Row);
}

export async function createHour(input: {
  barber: string;
  day: number;
  start: number;
  end: number;
}): Promise<Hour> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.hours,
    documentId: ID.unique(),
    data: input,
  });
  return toHour(row as Row);
}

export async function deleteHour(id: string): Promise<void> {
  await remove(TABLES.hours, id);
}

/**
 * One override per chair and date. Adding another replaces the existing row so
 * availability never has to guess which one wins.
 */
export async function putDay(input: {
  barber: string;
  date: string;
  open: boolean;
  start: number;
  end: number;
  note: string;
}): Promise<DayOverride> {
  const existing = await list(TABLES.days, [
    Query.equal("barber", input.barber),
    Query.equal("date", input.date),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    const row = await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: TABLES.days,
      documentId: existing[0].$id,
      data: {
        open: input.open,
        start: input.start,
        end: input.end,
        note: input.note,
      },
    });
    return toDay(row as Row);
  }

  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.days,
    documentId: ID.unique(),
    data: input,
  });
  return toDay(row as Row);
}

export async function deleteDay(id: string): Promise<void> {
  await remove(TABLES.days, id);
}

export async function deleteReview(id: string): Promise<void> {
  await remove(TABLES.reviews, id);
}
