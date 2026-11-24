import "server-only";

import { AppwriteException, ID, Query, Users, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { createAdminClient } from "@/lib/appwrite/server";

import { setBookingStatus } from "./data";
import {
  STATUSES,
  type Barber,
  type Booking,
  type BookingRow,
  type Role,
  type Service,
  type Status,
} from "./types";
import { enrich } from "./views";

type Row = Models.Document & Record<string, unknown>;

/** A chair with its linked staff account, including inactive chairs. */
export type AdminBarber = Barber & { user: string };

/** An Appwrite account joined with its profile and linked chair. */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  barber: string;
  /** Appwrite account status — `true` active, `false` blocked. */
  status: boolean;
  /** Count of low-rated reviews this member has written. */
  flags: number;
  created: string;
};

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

function toService(row: Row): Service {
  return {
    id: row.$id,
    name: str(row.name),
    note: str(row.note),
    price: num(row.price),
    time: num(row.time, 30),
    active: bool(row.active, true),
    image: str(row.image),
    category: str(row.category, "Hair"),
    featured: bool(row.featured),
    discount: num(row.discount),
    barber: str(row.barber),
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

/**
 * Read a whole table in pages. Reporting and moderation must not silently
 * sample the first 100 rows, so paged reads are used when counting or listing.
 */
async function listPaged(
  table: string,
  queries: string[] = [],
  cap = 1000,
): Promise<Row[]> {
  const rows: Row[] = [];
  const page = 100;
  for (let offset = 0; offset < cap; offset += page) {
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

/** Accounts with their profile role and the chair they are linked to. */
export async function listUsers(): Promise<AdminUser[]> {
  const users = new Users(createAdminClient());

  const [auth, profiles, chairs, reviews] = await Promise.all([
    users.list({ queries: [Query.limit(100)], total: false }),
    list(TABLES.users, [Query.limit(100)]),
    list(TABLES.barbers, [Query.limit(100)]),
    list(TABLES.reviews, [Query.limit(100)]),
  ]);

  const profileById = new Map(profiles.map((row) => [row.$id, row]));
  const chairByUser = new Map<string, string>();
  for (const chair of chairs) {
    const linked = str(chair.user);
    if (linked && !chairByUser.has(linked)) chairByUser.set(linked, chair.$id);
  }

  // A "flag" is a real signal: a low-rated review. There is no reports table.
  const flags = new Map<string, number>();
  for (const review of reviews) {
    if (num(review.rate, 5) <= 2) {
      const author = str(review.user);
      flags.set(author, (flags.get(author) ?? 0) + 1);
    }
  }

  return auth.users.map((user) => {
    const profile = profileById.get(user.$id);
    return {
      id: user.$id,
      name: str(profile?.name) || user.name || "",
      email: user.email || "",
      role: str(profile?.role, "client") as Role,
      phone: str(profile?.phone) || user.phone || "",
      barber: chairByUser.get(user.$id) ?? "",
      status: user.status !== false,
      flags: flags.get(user.$id) ?? 0,
      created: user.$createdAt ?? str(profile?.$createdAt),
    };
  });
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

/** Fields an admin may edit on a published chair. */
export type BarberEditInput = {
  name?: string;
  title?: string;
  bio?: string;
  photo?: string;
  cover?: string;
  shop?: string;
  address?: string;
  city?: string;
  years?: number;
  skills?: string;
  phone?: string;
  social?: string;
  facilities?: string;
  policy?: string;
  confirm?: boolean;
  featured?: boolean;
  user?: string;
};

/** Change published chair details and/or its linked staff account. */
export async function updateBarber(
  id: string,
  input: BarberEditInput,
): Promise<AdminBarber> {
  const data: Record<string, unknown> = {};
  const textKeys = [
    "name",
    "title",
    "bio",
    "photo",
    "cover",
    "shop",
    "address",
    "city",
    "skills",
    "phone",
    "social",
    "facilities",
    "policy",
  ] as const;
  for (const key of textKeys) {
    const value = input[key];
    if (typeof value === "string") data[key] = value;
  }
  if (typeof input.years === "number") data.years = input.years;
  if (typeof input.confirm === "boolean") data.confirm = input.confirm;
  if (typeof input.featured === "boolean") data.featured = input.featured;
  if (typeof input.user === "string") data.user = input.user;

  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: id,
    data,
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

/** Change a menu item's published details. */
export async function updateService(
  id: string,
  input: { name?: string; note?: string; price?: number; time?: number },
): Promise<Service> {
  const data: Record<string, unknown> = {};
  if (typeof input.name === "string") data.name = input.name;
  if (typeof input.note === "string") data.note = input.note;
  if (typeof input.price === "number") data.price = input.price;
  if (typeof input.time === "number") data.time = input.time;

  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: id,
    data,
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

/** Change a member's role in their profile row. */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.users,
    documentId: userId,
    data: { role },
  });
}

/**
 * Put a staff account on one chair. The account is removed from any other
 * chair first, so a barber never appears twice. An empty chair id just clears
 * the account from every chair.
 */
export async function linkBarberUser(
  barberId: string,
  userId: string,
): Promise<void> {
  if (!userId) {
    if (barberId) {
      await adminDb().updateDocument({
        databaseId: databaseId(),
        collectionId: TABLES.barbers,
        documentId: barberId,
        data: { user: "" },
      });
    }
    return;
  }

  const chairs = await list(TABLES.barbers, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);

  for (const chair of chairs) {
    if (chair.$id !== barberId) {
      await adminDb().updateDocument({
        databaseId: databaseId(),
        collectionId: TABLES.barbers,
        documentId: chair.$id,
        data: { user: "" },
      });
    }
  }

  if (!barberId) return;

  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: barberId,
    data: { user: userId },
  });
}

/* ------------------------------------------------------- extended platform */

/** Tables that live outside the core catalogue helper ids. */
const EXTRA = {
  notifications: "notifications",
  portfolio: "portfolio",
  categories: "categories",
  payments: "payments",
} as const;

export type PortfolioItem = {
  id: string;
  barber: string;
  url: string;
  note: string;
  created: string;
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
};

export type Payment = {
  id: string;
  booking: string;
  amount: number;
  status: string;
  method: string;
  created: string;
};

export type Announcement = {
  id: string;
  user: string;
  title: string;
  body: string;
  kind: string;
  state: string;
  created: string;
};

export type Audience = "all" | Role;

export type ActivityItem = {
  id: string;
  kind: "user" | "booking" | "review" | "payment" | "announcement";
  title: string;
  detail: string;
  at: string;
};

export type NamedCount = {
  name: string;
  count: number;
  value: number;
};

export type DashboardData = {
  totals: {
    users: number;
    customers: number;
    barbers: number;
    staff: number;
    chairs: number;
    activeBusinesses: number;
    bookings: number;
    reviews: number;
    revenue: number;
    bookedValue: number;
  };
  growth: { users: number; bookings: number; revenue: number };
  byStatus: Record<Status, number>;
  cancellationRate: number;
  recent: ActivityItem[];
  popularServices: NamedCount[];
  cities: NamedCount[];
  featured: number;
};

export type ReportPoint = { date: string; count: number; value: number };

export type ReportData = {
  days: number;
  from: string;
  to: string;
  series: {
    users: ReportPoint[];
    barbers: ReportPoint[];
    bookings: ReportPoint[];
    revenue: ReportPoint[];
  };
  totals: {
    users: number;
    barbers: number;
    bookings: number;
    revenue: number;
    done: number;
    cancel: number;
    noshow: number;
  };
  popularServices: NamedCount[];
  cities: NamedCount[];
  retention: number;
  cancellationRate: number;
};

export type BookingDetail = {
  booking: BookingRow;
  review: AdminReview | null;
  payments: Payment[];
  history: BookingRow[];
};

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

function toPayment(row: Row): Payment {
  return {
    id: row.$id,
    booking: str(row.booking),
    amount: num(row.amount),
    status: str(row.status, "pending"),
    method: str(row.method, "cash"),
    created: row.$createdAt,
  };
}

function toPortfolio(row: Row): PortfolioItem {
  return {
    id: row.$id,
    barber: str(row.barber),
    url: str(row.url),
    note: str(row.note),
    created: row.$createdAt,
  };
}

function toCategory(row: Row): Category {
  return { id: row.$id, name: str(row.name), active: bool(row.active, true) };
}

function toAnnouncement(row: Row): Announcement {
  return {
    id: row.$id,
    user: str(row.user),
    title: str(row.title),
    body: str(row.body),
    kind: str(row.kind),
    state: str(row.state),
    created: row.$createdAt,
  };
}

function percentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function changePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Last 30 days vs the 30 days before it, using document creation dates. */
function growth<T extends { $createdAt: string }>(
  rows: T[],
  amount?: (row: T) => number,
): number {
  const day = 86_400_000;
  const now = Date.now();
  const recentStart = now - 30 * day;
  const priorStart = now - 60 * day;
  let recent = 0;
  let prior = 0;

  for (const row of rows) {
    const time = Date.parse(row.$createdAt);
    if (Number.isNaN(time)) continue;
    const value = amount ? amount(row) : 1;
    if (time >= recentStart) recent += value;
    else if (time >= priorStart) prior += value;
  }

  return changePercent(recent, prior);
}

function rankCounts(items: NamedCount[]): NamedCount[] {
  return items
    .filter((item) => item.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
}

/* ------------------------------------------------------------- user writes */

/** Block or reactivate an Appwrite account without deleting its profile. */
export async function setUserStatus(userId: string, active: boolean): Promise<void> {
  const users = new Users(createAdminClient());
  await users.updateStatus({ userId, status: active });
}

/* ------------------------------------------------------- barber management */

/** Put a chair on the featured list, or take it off. */
export async function setBarberFeatured(
  id: string,
  featured: boolean,
): Promise<AdminBarber> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: id,
    data: { featured },
  });
  return toAdminBarber(row as Row);
}

/** Every portfolio item, newest first, optionally for one chair. */
export async function listPortfolio(barber?: string): Promise<PortfolioItem[]> {
  const queries = barber
    ? [Query.equal("barber", barber), Query.limit(100)]
    : [Query.orderDesc("$createdAt"), Query.limit(100)];
  const rows = await list(EXTRA.portfolio, queries);
  return rows
    .map(toPortfolio)
    .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
}

/** Remove a portfolio image that breaches the house rules. */
export async function deletePortfolioItem(id: string): Promise<void> {
  await remove(EXTRA.portfolio, id);
}

/* -------------------------------------------------------- appointment reads */

export type BookingFilter = {
  status?: string;
  date?: string;
  barber?: string;
};

/** All bookings with names, newest first. Filters are applied in Appwrite. */
export async function listAdminBookings(
  filter: BookingFilter = {},
): Promise<BookingRow[]> {
  const queries = [Query.orderDesc("$createdAt")];
  if (filter.status) queries.push(Query.equal("status", filter.status));
  if (filter.date) queries.push(Query.equal("date", filter.date));
  if (filter.barber) queries.push(Query.equal("barber", filter.barber));

  const rows = await listPaged(TABLES.bookings, queries);
  return enrich(rows.map(toBooking), { withUser: true });
}

/** Lightweight lookup before a status write, so a missing row is a real 404. */
export async function findAdminBooking(id: string): Promise<BookingRow | null> {
  const row = await get(TABLES.bookings, id);
  if (!row) return null;
  const [enriched] = await enrich([toBooking(row)], { withUser: true });
  return enriched;
}

/** One booking with the supporting rows an admin needs for a dispute. */
export async function getAdminBookingDetail(
  id: string,
): Promise<BookingDetail | null> {
  const row = await get(TABLES.bookings, id);
  if (!row) return null;
  const booking = toBooking(row);

  const [enriched, reviews, payments, historyRows] = await Promise.all([
    enrich([booking], { withUser: true }),
    list(TABLES.reviews, [Query.equal("booking", id), Query.limit(1)]),
    list(EXTRA.payments, [Query.equal("booking", id), Query.limit(100)]),
    list(TABLES.bookings, [
      Query.equal("user", booking.user),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]),
  ]);

  const history = await enrich(
    historyRows
      .map(toBooking)
      .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0)),
    { withUser: false },
  );

  return {
    booking: enriched[0],
    review: reviews[0] ? toAdminReview(reviews[0]) : null,
    payments: payments.map(toPayment),
    history,
  };
}

/** Change any visit status with the same writer the booking API uses. */
export async function setAdminBookingStatus(
  id: string,
  status: Status,
): Promise<BookingRow> {
  const updated = await setBookingStatus(id, status);
  const [row] = await enrich([updated], { withUser: true });
  return row;
}

/* ---------------------------------------------------------- configuration */

export async function listCategories(): Promise<Category[]> {
  const rows = await list(EXTRA.categories, [
    Query.orderAsc("name"),
    Query.limit(100),
  ]);
  return rows.map(toCategory);
}

export async function createCategory(name: string): Promise<Category> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.categories,
    documentId: ID.unique(),
    data: { name, active: true },
  });
  return toCategory(row as Row);
}

export async function renameCategory(id: string, name: string): Promise<Category> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.categories,
    documentId: id,
    data: { name },
  });
  return toCategory(row as Row);
}

export async function setCategoryActive(
  id: string,
  active: boolean,
): Promise<Category> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.categories,
    documentId: id,
    data: { active },
  });
  return toCategory(row as Row);
}

export async function deleteCategory(id: string): Promise<void> {
  await remove(EXTRA.categories, id);
}

/** Broadcast a message to every profile, or one role, as inbox notifications. */
export async function createAnnouncement(input: {
  title: string;
  body: string;
  audience: Audience;
}): Promise<{ sent: number }> {
  const queries =
    input.audience === "all"
      ? [Query.limit(100)]
      : [Query.equal("role", input.audience), Query.limit(100)];
  const recipients = await list(TABLES.users, queries);

  for (const recipient of recipients) {
    await adminDb().createDocument({
      databaseId: databaseId(),
      collectionId: EXTRA.notifications,
      documentId: ID.unique(),
      data: {
        user: recipient.$id,
        title: input.title,
        body: input.body,
        kind: "announcement",
        state: "new",
      },
    });
  }

  return { sent: recipients.length };
}

/** Recent broadcasts, for the composer's history list. */
export async function listAnnouncements(): Promise<Announcement[]> {
  const rows = await list(EXTRA.notifications, [
    Query.equal("kind", "announcement"),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return rows.map(toAnnouncement);
}

/* ------------------------------------------------------------------- stats */

/** Live platform overview. Every figure comes from a table or the Users API. */
export async function getDashboard(): Promise<DashboardData> {
  const [auth, profiles, chairs, bookings, reviews, payments, announcements] =
    await Promise.all([
      new Users(createAdminClient()).list({
        queries: [Query.limit(100)],
        total: true,
      }),
      list(TABLES.users, [Query.limit(100)]),
      list(TABLES.barbers, [Query.limit(100)]),
      listPaged(TABLES.bookings, [Query.orderDesc("$createdAt")]),
      list(TABLES.reviews, [Query.limit(100)]),
      listPaged(EXTRA.payments, [Query.orderDesc("$createdAt")]),
      list(EXTRA.notifications, [
        Query.equal("kind", "announcement"),
        Query.orderDesc("$createdAt"),
        Query.limit(10),
      ]),
    ]);

  const serviceNames = new Map(
    (
      await list(TABLES.services, [Query.limit(100)])
    ).map((row) => [row.$id, str(row.name)]),
  );
  const cityByChair = new Map(
    chairs.map((row) => [row.$id, str(row.city, "Tashkent")]),
  );

  const byStatus = Object.fromEntries(
    STATUSES.map((status) => [status, 0]),
  ) as Record<Status, number>;
  const services = new Map<string, NamedCount>();
  const cities = new Map<string, NamedCount>();
  let bookedValue = 0;

  for (const row of bookings) {
    const status = str(row.status, "booked") as Status;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const service = str(row.service);
    if (service && status !== "cancel" && status !== "rejected") {
      const entry = services.get(service) ?? {
        name: serviceNames.get(service) || "Service",
        count: 0,
        value: 0,
      };
      entry.count += 1;
      entry.value += num(row.price);
      services.set(service, entry);
      bookedValue += num(row.price);
    }
    const city = cityByChair.get(str(row.barber)) ?? "Tashkent";
    const place = cities.get(city) ?? { name: city, count: 0, value: 0 };
    place.count += 1;
    cities.set(city, place);
  }

  const paid = payments.filter((row) => str(row.status, "pending") === "paid");
  const revenue = paid.reduce((total, row) => total + num(row.amount), 0);
  const customers = profiles.filter(
    (row) => str(row.role, "client") === "client",
  ).length;
  const barbers = profiles.filter((row) => str(row.role) === "barber").length;
  const staff = profiles.filter((row) =>
    ["barber", "admin"].includes(str(row.role)),
  ).length;

  const usersRows: Array<{ $createdAt: string }> = profiles.map((row) => ({
    $createdAt: row.$createdAt,
  }));
  const recent: ActivityItem[] = [
    ...profiles.map((row) => ({
      id: row.$id,
      kind: "user" as const,
      title: str(row.name) || "New member",
      detail: "Joined icone",
      at: row.$createdAt,
    })),
    ...bookings.slice(0, 20).map((row) => ({
      id: row.$id,
      kind: "booking" as const,
      title: str(row.status, "booked"),
      detail: `${str(row.date)} · ${str(row.service)}`,
      at: row.$createdAt,
    })),
    ...reviews.map((row) => ({
      id: row.$id,
      kind: "review" as const,
      title: `${num(row.rate, 5)} / 5`,
      detail: str(row.note).slice(0, 80) || "Review",
      at: row.$createdAt,
    })),
    ...paid.slice(0, 20).map((row) => ({
      id: row.$id,
      kind: "payment" as const,
      title: `${num(row.amount).toLocaleString("ru-RU")} UZS`,
      detail: `Paid by ${str(row.method, "cash")}`,
      at: row.$createdAt,
    })),
    ...announcements.map(toAnnouncement).map((row) => ({
      id: row.id,
      kind: "announcement" as const,
      title: row.title,
      detail: "Broadcast sent",
      at: row.created,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 12);

  return {
    totals: {
      users: auth.total || profiles.length,
      customers,
      barbers,
      staff,
      chairs: chairs.length,
      activeBusinesses: chairs.filter(
        (row) => bool(row.active) && str(row.shop),
      ).length,
      bookings: bookings.length,
      reviews: reviews.length,
      revenue,
      bookedValue,
    },
    growth: {
      users: growth(usersRows),
      bookings: growth(bookings),
      revenue: growth(paid, (row) => num(row.amount)),
    },
    byStatus,
    cancellationRate: percentage(byStatus.cancel, bookings.length),
    recent,
    popularServices: rankCounts([...services.values()]),
    cities: rankCounts([...cities.values()]),
    featured: chairs.filter((row) => bool(row.featured)).length,
  };
}

function buildSeries<T extends { $createdAt: string }>(
  days: number,
  rows: T[],
  amount?: (row: T) => number,
): ReportPoint[] {
  const day = 86_400_000;
  const bucketDays = Math.max(1, Math.ceil(days / 30));
  const bucketMs = bucketDays * day;
  const end = Date.now();
  const start = end - days * day;
  const points: ReportPoint[] = Array.from(
    { length: Math.max(1, Math.ceil(days / bucketDays)) },
    (_, index) => ({
      date: new Date(start + index * bucketMs).toISOString().slice(0, 10),
      count: 0,
      value: 0,
    }),
  );

  for (const row of rows) {
    const time = Date.parse(row.$createdAt);
    if (Number.isNaN(time) || time < start || time > end) continue;
    const index = Math.min(points.length - 1, Math.floor((time - start) / bucketMs));
    points[index].count += 1;
    if (amount) points[index].value += amount(row);
  }
  return points;
}

/** Trend and breakdown report over a real window of document creation dates. */
export async function getReports(days: number): Promise<ReportData> {
  const [profiles, chairs, bookings, payments] = await Promise.all([
    listPaged(TABLES.users),
    listPaged(TABLES.barbers),
    listPaged(TABLES.bookings),
    listPaged(EXTRA.payments),
  ]);

  const day = 86_400_000;
  const end = Date.now();
  const from = new Date(end - days * day).toISOString().slice(0, 10);
  const to = new Date(end).toISOString().slice(0, 10);

  const inWindow = (row: Row): boolean => {
    const time = Date.parse(row.$createdAt);
    return !Number.isNaN(time) && time >= end - days * day && time <= end;
  };

  const paid = payments.filter(
    (row) => str(row.status, "pending") === "paid",
  );
  const serviceNames = new Map(
    (
      await list(TABLES.services, [Query.limit(100)])
    ).map((row) => [row.$id, str(row.name)]),
  );
  const cityByChair = new Map(
    chairs.map((row) => [row.$id, str(row.city, "Tashkent")]),
  );

  const services = new Map<string, NamedCount>();
  const cities = new Map<string, NamedCount>();
  const bookingsByUser = new Map<string, number>();

  for (const row of bookings) {
    const status = str(row.status, "booked") as Status;
    const service = str(row.service);
    if (service && status !== "cancel" && status !== "rejected") {
      const entry = services.get(service) ?? {
        name: serviceNames.get(service) || "Service",
        count: 0,
        value: 0,
      };
      entry.count += 1;
      entry.value += num(row.price);
      services.set(service, entry);
    }
    const placeName = cityByChair.get(str(row.barber)) ?? "Tashkent";
    const place = cities.get(placeName) ?? {
      name: placeName,
      count: 0,
      value: 0,
    };
    place.count += 1;
    cities.set(placeName, place);
    const user = str(row.user);
    bookingsByUser.set(user, (bookingsByUser.get(user) ?? 0) + 1);
  }

  const withBooking = [...bookingsByUser.values()].filter((count) => count > 0);
  const returning = withBooking.filter((count) => count >= 2).length;
  const cancelled = bookings.filter(
    (row) => str(row.status) === "cancel",
  ).length;

  return {
    days,
    from,
    to,
    series: {
      users: buildSeries(days, profiles),
      barbers: buildSeries(days, chairs),
      bookings: buildSeries(days, bookings),
      revenue: buildSeries(days, paid, (row) => num(row.amount)),
    },
    totals: {
      users: profiles.filter(inWindow).length,
      barbers: profiles.filter(
        (row) => inWindow(row) && str(row.role) === "barber",
      ).length,
      bookings: bookings.filter(inWindow).length,
      revenue: paid.filter(inWindow).reduce((sum, row) => sum + num(row.amount), 0),
      done: bookings.filter(
        (row) => inWindow(row) && str(row.status) === "done",
      ).length,
      cancel: bookings.filter(
        (row) => inWindow(row) && str(row.status) === "cancel",
      ).length,
      noshow: bookings.filter(
        (row) => inWindow(row) && str(row.status) === "noshow",
      ).length,
    },
    popularServices: rankCounts([...services.values()]),
    cities: rankCounts([...cities.values()]),
    retention: percentage(returning, withBooking.length),
    cancellationRate: percentage(cancelled, bookings.length),
  };
}


