import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";

import type {
  Barber,
  Booking,
  Profile,
  Review,
  Role,
  Service,
  Status,
} from "./types";

type Row = Models.Document & Record<string, unknown>;

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

function toBooking(row: Row): Booking {
  return {
    id: row.$id,
    user: str(row.user),
    barber: str(row.barber),
    service: str(row.service),
    date: str(row.date),
    start: num(row.start),
    end: num(row.end),
    price: num(row.price),
    status: str(row.status, "booked") as Status,
    note: str(row.note),
    created: row.$createdAt,
  };
}

function toReview(row: Row): Review {
  return {
    id: row.$id,
    user: str(row.user),
    barber: str(row.barber),
    booking: str(row.booking),
    rate: num(row.rate, 5),
    note: str(row.note),
    created: row.$createdAt,
    userName: "",
  };
}

function toProfile(row: Row): Profile {
  return {
    id: row.$id,
    name: str(row.name),
    phone: str(row.phone),
    role: str(row.role, "client") as Role,
    avatar: str(row.avatar),
  };
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

async function list(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

/* ------------------------------------------------------------------ reads */

export async function listBarbers(): Promise<Barber[]> {
  const rows = await list(TABLES.barbers, [
    Query.equal("active", true),
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return rows.map(toBarber);
}

export async function listServices(): Promise<Service[]> {
  const rows = await list(TABLES.services, [
    Query.equal("active", true),
    Query.orderAsc("price"),
    Query.limit(50),
  ]);
  return rows.map(toService);
}

export async function getBarber(id: string): Promise<Barber | null> {
  const row = await get(TABLES.barbers, id);
  return row ? toBarber(row) : null;
}

/** The chair linked to a staff account, if any. */
export async function barberForUser(userId: string): Promise<Barber | null> {
  const rows = await list(TABLES.barbers, [
    Query.equal("user", userId),
    Query.limit(1),
  ]);
  return rows.length > 0 ? toBarber(rows[0]) : null;
}

export async function getService(id: string): Promise<Service | null> {
  const row = await get(TABLES.services, id);
  return row ? toService(row) : null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await get(TABLES.users, userId);
  return row ? toProfile(row) : null;
}

/** Create the profile row on first sign-in. Safe to call repeatedly. */
export async function ensureProfile(user: {
  $id: string;
  name: string;
}): Promise<Profile> {
  const existing = await getProfile(user.$id);
  if (existing) return existing;

  const name = user.name.trim() || "Member";

  try {
    const row = await adminDb().createDocument({
      databaseId: databaseId(),
      collectionId: TABLES.users,
      documentId: user.$id,
      data: { name, phone: "", role: "client", avatar: "" },
    });
    return toProfile(row as Row);
  } catch (error) {
    // Lost a race with a parallel request: read the row it created.
    if (error instanceof AppwriteException && error.code === 409) {
      const created = await getProfile(user.$id);
      if (created) return created;
    }
    throw error;
  }
}

export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string },
): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (typeof data.name === "string") patch.name = data.name;
  if (typeof data.phone === "string") patch.phone = data.phone;

  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.users,
    documentId: userId,
    data: patch,
  });
  return toProfile(row as Row);
}

export async function listUserBookings(userId: string): Promise<Booking[]> {
  const rows = await list(TABLES.bookings, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);
  return rows
    .map(toBooking)
    .sort((a, b) =>
      a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1,
    );
}

export async function listAgenda(
  date: string,
  barberId?: string,
): Promise<Booking[]> {
  const queries = [Query.equal("date", date), Query.limit(100)];
  if (barberId) queries.push(Query.equal("barber", barberId));

  const rows = await list(TABLES.bookings, queries);
  return rows
    .map(toBooking)
    .filter((booking) => booking.status !== "cancel")
    .sort((a, b) => a.start - b.start);
}

/** Non-cancelled bookings that block a barber's day. */
export async function listBusy(
  barberId: string,
  date: string,
): Promise<Booking[]> {
  const rows = await list(TABLES.bookings, [
    Query.equal("barber", barberId),
    Query.equal("date", date),
    Query.equal("status", ["booked", "done"]),
    Query.limit(100),
  ]);
  return rows.map(toBooking);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const row = await get(TABLES.bookings, id);
  return row ? toBooking(row) : null;
}

export async function listReviews(barberId: string): Promise<Review[]> {
  const rows = await list(TABLES.reviews, [
    Query.equal("barber", barberId),
    Query.limit(50),
  ]);
  return rows
    .map(toReview)
    .sort((a, b) => (a.created < b.created ? 1 : -1));
}

export async function getReviewByBooking(
  bookingId: string,
): Promise<Review | null> {
  const rows = await list(TABLES.reviews, [
    Query.equal("booking", bookingId),
    Query.limit(1),
  ]);
  return rows.length > 0 ? toReview(rows[0]) : null;
}

/** Every review one member has written, newest first. */
export async function listReviewsByUser(userId: string): Promise<Review[]> {
  const rows = await list(TABLES.reviews, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);
  return rows
    .map(toReview)
    .sort((a, b) => (a.created < b.created ? 1 : -1));
}

export type Window = { start: number; end: number };

/** Weekly opening hours for one barber. */
export async function listHours(barber: string): Promise<
  Array<Window & { day: number }>
> {
  const rows = await list(TABLES.hours, [
    Query.equal("barber", barber),
    Query.limit(50),
  ]);
  return rows.map((row) => ({
    day: num(row.day),
    start: num(row.start),
    end: num(row.end),
  }));
}

/** Date-specific override, if the shop added one. */
export async function getDay(
  barber: string,
  date: string,
): Promise<(Window & { open: boolean; note: string }) | null> {
  const rows = await list(TABLES.days, [
    Query.equal("barber", barber),
    Query.equal("date", date),
    Query.limit(1),
  ]);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    open: bool(row.open),
    start: num(row.start),
    end: num(row.end),
    note: str(row.note),
  };
}

/* ----------------------------------------------------------------- writes */

/** Fetch several documents by id in one request. */
export async function getMany(
  table: string,
  ids: string[],
): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const rows = await list(table, [Query.equal("$id", unique), Query.limit(100)]);
  return rows;
}

export async function createBooking(data: {
  user: string;
  barber: string;
  service: string;
  date: string;
  start: number;
  end: number;
  price: number;
  note: string;
}): Promise<Booking> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.bookings,
    documentId: ID.unique(),
    data: { ...data, status: "booked" },
  });
  return toBooking(row as Row);
}

export async function setBookingStatus(
  id: string,
  status: Status,
): Promise<Booking> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.bookings,
    documentId: id,
    data: { status },
  });
  return toBooking(row as Row);
}

export async function deleteBooking(id: string): Promise<void> {
  await adminDb().deleteDocument({
    databaseId: databaseId(),
    collectionId: TABLES.bookings,
    documentId: id,
  });
}

export async function createReview(data: {
  user: string;
  barber: string;
  booking: string;
  rate: number;
  note: string;
}): Promise<Review> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.reviews,
    documentId: ID.unique(),
    data,
  });
  return toReview(row as Row);
}

/** Recompute a barber's average rating from their reviews. */
export async function refreshRating(barberId: string): Promise<number> {
  const reviews = await listReviews(barberId);
  if (reviews.length === 0) return 0;

  const average =
    reviews.reduce((total, review) => total + review.rate, 0) / reviews.length;
  const rounded = Math.round(average * 10) / 10;

  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: barberId,
    data: { rating: rounded },
  });

  return rounded;
}
