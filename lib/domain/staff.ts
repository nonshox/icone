import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";

import {
  barberForUser,
  getMany,
  listAgenda,
} from "./data";
import { nextDates } from "./time";
import type { Barber, BookingRow } from "./types";

type Row = Models.Document & Record<string, unknown>;

/** One weekly opening window for the caller's own chair. */
export type StaffHour = {
  id: string;
  barber: string;
  day: number;
  start: number;
  end: number;
};

/** One date override for the caller's own chair. */
export type StaffDay = {
  id: string;
  barber: string;
  date: string;
  open: boolean;
  start: number;
  end: number;
  note: string;
};

export type StaffErrorCode = "no_chair" | "not_found" | "forbidden";

/** Domain error with a stable code and HTTP status for route handlers. */
export class StaffError extends Error {
  readonly code: StaffErrorCode;
  readonly status: number;

  constructor(message: string, code: StaffErrorCode, status: number) {
    super(message);
    this.name = "StaffError";
    this.code = code;
    this.status = status;
  }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toBarber(row: Row): Barber {
  return {
    id: row.$id,
    name: str(row.name),
    title: str(row.title),
    bio: str(row.bio),
    photo: str(row.photo),
    rating: num(row.rating),
    active: bool(row.active, true),
    shop: str(row.shop),
    address: str(row.address),
    city: str(row.city, "Tashkent"),
    years: num(row.years),
    skills: str(row.skills),
    phone: str(row.phone),
    social: str(row.social),
    facilities: str(row.facilities),
    policy: str(row.policy),
    cover: str(row.cover),
    confirm: bool(row.confirm),
    featured: bool(row.featured),
  };
}

function toHour(row: Row): StaffHour {
  return {
    id: row.$id,
    barber: str(row.barber),
    day: num(row.day),
    start: num(row.start),
    end: num(row.end),
  };
}

function toDay(row: Row): StaffDay {
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

async function getRow(table: string, id: string): Promise<Row | null> {
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

async function listRows(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

/** Resolve the caller's chair. Every staff write goes through this. */
async function ownChair(userId: string): Promise<Barber> {
  const chair = await barberForUser(userId);
  if (!chair) {
    throw new StaffError(
      "Your account is not linked to a chair yet.",
      "no_chair",
      403,
    );
  }
  return chair;
}

/* ------------------------------------------------------------------ reads */

export async function getMyChair(userId: string): Promise<Barber | null> {
  return barberForUser(userId);
}

export async function listMyHours(userId: string): Promise<StaffHour[]> {
  const chair = await ownChair(userId);
  const rows = await listRows(TABLES.hours, [
    Query.equal("barber", chair.id),
    Query.limit(50),
  ]);
  return rows
    .map(toHour)
    .sort((a, b) => (a.day === b.day ? a.start - b.start : a.day - b.day));
}

export async function listMyDays(userId: string): Promise<StaffDay[]> {
  const chair = await ownChair(userId);
  const rows = await listRows(TABLES.days, [
    Query.equal("barber", chair.id),
    Query.limit(50),
  ]);
  return rows.map(toDay).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Upcoming bookings on the caller's chair, grouped by the client. */
export async function listMyUpcoming(
  userId: string,
  days: number,
): Promise<BookingRow[]> {
  const chair = await ownChair(userId);
  const count = Math.max(1, Math.min(60, Math.floor(days)));
  const dates = nextDates(count);

  const booked = (await Promise.all(dates.map((date) => listAgenda(date, chair.id)))).flat();
  booked.sort((a, b) =>
    a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1,
  );

  if (booked.length === 0) return [];

  const [barbers, services, users] = await Promise.all([
    getMany(TABLES.barbers, booked.map((row) => row.barber)),
    getMany(TABLES.services, booked.map((row) => row.service)),
    getMany(TABLES.users, booked.map((row) => row.user)),
  ]);

  const barberName = new Map(barbers.map((row) => [row.$id, str(row.name)]));
  const service = new Map(
    services.map((row) => [
      row.$id,
      { name: str(row.name), time: num(row.time, 30) },
    ]),
  );
  const userName = new Map(users.map((row) => [row.$id, str(row.name)]));

  return booked.map((row) => ({
    ...row,
    barberName: barberName.get(row.barber) ?? "Barber",
    serviceName: service.get(row.service)?.name ?? "Service",
    serviceTime: service.get(row.service)?.time ?? 30,
    userName: userName.get(row.user) ?? "Member",
  }));
}

/* ----------------------------------------------------------------- writes */

export async function updateMyChair(
  userId: string,
  input: { title: string; bio: string; photo: string },
): Promise<Barber> {
  const chair = await ownChair(userId);
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: chair.id,
    data: { title: input.title, bio: input.bio, photo: input.photo },
  });
  return toBarber(row as Row);
}

export async function createMyHour(
  userId: string,
  input: { day: number; start: number; end: number },
): Promise<StaffHour> {
  const chair = await ownChair(userId);
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.hours,
    documentId: ID.unique(),
    data: { barber: chair.id, day: input.day, start: input.start, end: input.end },
  });
  return toHour(row as Row);
}

export async function deleteMyHour(userId: string, id: string): Promise<void> {
  const chair = await ownChair(userId);
  const row = await getRow(TABLES.hours, id);
  if (!row) {
    throw new StaffError("Those opening hours no longer exist.", "not_found", 404);
  }
  if (str(row.barber) !== chair.id) {
    throw new StaffError("Those opening hours are not yours.", "forbidden", 403);
  }

  try {
    await adminDb().deleteDocument({
      databaseId: databaseId(),
      collectionId: TABLES.hours,
      documentId: id,
    });
  } catch (error) {
    // Deleting an already-gone row is fine.
    if (!(error instanceof AppwriteException && error.code === 404)) throw error;
  }
}

/** One override per chair and date. Adding another replaces the existing row. */
export async function saveMyDay(
  userId: string,
  input: { date: string; open: boolean; start: number; end: number; note: string },
): Promise<StaffDay> {
  const chair = await ownChair(userId);
  const data = {
    open: input.open,
    start: input.start,
    end: input.end,
    note: input.note,
  };

  const existing = await listRows(TABLES.days, [
    Query.equal("barber", chair.id),
    Query.equal("date", input.date),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    const row = await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: TABLES.days,
      documentId: existing[0].$id,
      data,
    });
    return toDay(row as Row);
  }

  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.days,
    documentId: ID.unique(),
    data: { barber: chair.id, date: input.date, ...data },
  });
  return toDay(row as Row);
}

export async function deleteMyDay(userId: string, id: string): Promise<void> {
  const chair = await ownChair(userId);
  const row = await getRow(TABLES.days, id);
  if (!row) {
    throw new StaffError("That date override no longer exists.", "not_found", 404);
  }
  if (str(row.barber) !== chair.id) {
    throw new StaffError("That date override is not yours.", "forbidden", 403);
  }

  try {
    await adminDb().deleteDocument({
      databaseId: databaseId(),
      collectionId: TABLES.days,
      documentId: id,
    });
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 404)) throw error;
  }
}
