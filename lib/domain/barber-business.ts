import "server-only";

import { Account, AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { createSessionClient } from "@/lib/appwrite/server";

import { barberForUser, getService, listReviews } from "./data";
import { addDays, today } from "./time";
import { STATUS_LABEL } from "./types";

// Tables outside the shared TABLES map live here, one lowercase word each.
const EXTRA = {
  payments: "payments",
  promotions: "promotions",
  portfolio: "portfolio",
  notes: "notes",
  notifications: "notifications",
} as const;

type Row = Models.Document & Record<string, unknown>;

/* ------------------------------------------------------------------ types */

export type BizErrorCode = "no_chair" | "not_found" | "forbidden" | "invalid";

export class BarberBusinessError extends Error {
  readonly code: BizErrorCode;
  readonly status: number;

  constructor(message: string, code: BizErrorCode, status: number) {
    super(message);
    this.name = "BarberBusinessError";
    this.code = code;
    this.status = status;
  }
}

export type ServiceInput = {
  name: string;
  note: string;
  price: number;
  time: number;
  image: string;
  category: string;
  featured: boolean;
  discount: number;
  active: boolean;
};

export type Promotion = {
  id: string;
  barber: string;
  name: string;
  kind: "percent" | "fixed";
  amount: number;
  start: string;
  end: string;
  uses: number;
  limit: number;
  note: string;
  active: boolean;
};
export type PromotionInput = Omit<Promotion, "id" | "barber" | "uses">;

export type PortfolioItem = {
  id: string;
  barber: string;
  url: string;
  note: string;
  created: string;
};
export type PortfolioInput = Pick<PortfolioItem, "url" | "note">;

export type PrivateNote = {
  id: string;
  barber: string;
  user: string;
  note: string;
  created: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  visits: number;
  completed: number;
  spend: number;
  last: string;
  services: string[];
  note: string;
  noteId: string;
};

export type CustomerBooking = {
  id: string;
  date: string;
  time: string;
  service: string;
  status: string;
  price: number;
  note: string;
};

export type CustomerDetail = {
  customer: Customer;
  bookings: CustomerBooking[];
};

export type Appointment = {
  id: string;
  date: string;
  start: number;
  end: number;
  time: string;
  service: string;
  member: string;
  status: string;
  price: number;
};

export type CalendarDay = {
  date: string;
  total: number;
  appointments: Appointment[];
};

export type Activity = {
  id: string;
  when: string;
  text: string;
};

export type DashboardData = {
  chair: string;
  counts: {
    today: number;
    upcoming: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    booked: number;
    completed: number;
    paid: number;
    weekBooked: number;
    weekCompleted: number;
    weekPaid: number;
    monthBooked: number;
    monthCompleted: number;
    monthPaid: number;
  };
  rating: number;
  reviews: Array<{
    id: string;
    member: string;
    rate: number;
    note: string;
    date: string;
  }>;
  calendar: CalendarDay[];
  activity: Activity[];
  todayList: Appointment[];
};

export type EarningsFilter = {
  from: string;
  to: string;
  service: string;
  status: "all" | "done" | "booked";
};

export type EarningsData = {
  range: EarningsFilter;
  services: Array<{ id: string; name: string }>;
  counts: {
    bookings: number;
    completed: number;
    cancelled: number;
    customers: number;
    returning: number;
  };
  revenue: { booked: number; completed: number; paid: number };
  averages: { booking: number; customer: number; rating: number };
  popularServices: Array<{
    id: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  popularTimes: Array<{ hour: number; time: string; count: number }>;
  byDay: Array<{ date: string; count: number; revenue: number }>;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  state: string;
  created: string;
};

export type NotificationPrefs = {
  newBookings: boolean;
  cancellations: boolean;
  reviews: boolean;
  reminders: boolean;
};

export type BusinessProfileInput = {
  name?: string;
  title?: string;
  bio?: string;
  photo?: string;
  active?: boolean;
  shop?: string;
  address?: string;
  city?: string;
  years?: number;
  skills?: string;
  phone?: string;
  social?: string;
  facilities?: string;
  policy?: string;
  cover?: string;
  confirm?: boolean;
  featured?: boolean;
};

/* ---------------------------------------------------------------- helpers */

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}
function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
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

/** Fetch many rows by id, in chunks Appwrite accepts. */
async function many(table: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: Row[] = [];
  for (let index = 0; index < unique.length; index += 100) {
    rows.push(
      ...(await listAll(table, [
        Query.equal("$id", unique.slice(index, index + 100)),
      ])),
    );
  }
  return rows;
}

/** Read more than one Appwrite page without an unbounded loop. */
async function listAll(table: string, queries: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 2_000; offset += 100) {
    const page = await listRows(table, [
      ...queries,
      Query.limit(100),
      Query.offset(offset),
    ]);
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}

/** Every business operation starts here: only the caller's own chair. */
export async function requireChair(userId: string) {
  const chair = await barberForUser(userId);
  if (!chair) {
    throw new BarberBusinessError(
      "Your account is not linked to a chair yet.",
      "no_chair",
      403,
    );
  }
  return chair;
}

/** Fetch a row by id only when it belongs to the caller's chair. */
async function ownedRow(
  table: string,
  id: string,
  chairId: string,
  label: string,
): Promise<Row> {
  const row = await getRow(table, id);
  if (!row) {
    throw new BarberBusinessError(`That ${label} no longer exists.`, "not_found", 404);
  }
  if (str(row.barber) !== chairId) {
    throw new BarberBusinessError(`That ${label} is not yours.`, "forbidden", 403);
  }
  return row;
}

function toService(row: Row) {
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

function toPromotion(row: Row): Promotion {
  const kind = str(row.kind, "percent");
  return {
    id: row.$id,
    barber: str(row.barber),
    name: str(row.name),
    kind: kind === "fixed" ? "fixed" : "percent",
    amount: num(row.amount),
    start: str(row.start),
    end: str(row.end),
    uses: num(row.uses),
    limit: num(row.limit),
    note: str(row.note),
    active: bool(row.active, true),
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

function toNote(row: Row): PrivateNote {
  return {
    id: row.$id,
    barber: str(row.barber),
    user: str(row.user),
    note: str(row.note),
    created: row.$createdAt,
  };
}

function toNotification(row: Row): NotificationRow {
  return {
    id: row.$id,
    title: str(row.title),
    body: str(row.body),
    kind: str(row.kind, "info"),
    state: str(row.state, "new"),
    created: row.$createdAt,
  };
}

function nameOf(rows: Row[], id: string, fallback = "Member"): string {
  return str(rows.find((row) => row.$id === id)?.name, fallback) || fallback;
}

const money = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Payments for a set of bookings, read in chunks. */
async function paymentsFor(bookingIds: string[]): Promise<Row[]> {
  const unique = [...new Set(bookingIds)].filter(Boolean);
  const rows: Row[] = [];
  for (let index = 0; index < unique.length; index += 100) {
    rows.push(
      ...(await listAll(EXTRA.payments, [
        Query.equal("booking", unique.slice(index, index + 100)),
      ])),
    );
  }
  return rows;
}

function paidFor(bookingIds: string[], payments: Row[]): number {
  const ids = new Set(bookingIds);
  return money(
    payments
      .filter((row) => ids.has(str(row.booking)) && str(row.status) === "paid")
      .map((row) => num(row.amount)),
  );
}

function bookingsFor(chairId: string) {
  return listAll(TABLES.bookings, [
    Query.equal("barber", chairId),
    Query.orderDesc("date"),
  ]);
}

function appointment(
  row: ReturnType<typeof toBookingLite>,
  service: string,
  member: string,
): Appointment {
  return {
    id: row.id,
    date: row.date,
    start: row.start,
    end: row.end,
    time: `${String(Math.floor(row.start / 60)).padStart(2, "0")}:${String(row.start % 60).padStart(2, "0")}`,
    service,
    member,
    status: STATUS_LABEL[row.status] ?? row.status,
    price: row.price,
  };
}

function toBookingLite(row: Row) {
  return {
    id: row.$id,
    user: str(row.user),
    service: str(row.service),
    date: str(row.date),
    start: num(row.start),
    end: num(row.end),
    price: num(row.price),
    status: str(row.status, "booked") as keyof typeof STATUS_LABEL,
    note: str(row.note),
    created: row.$createdAt,
  };
}

const ACTIVE_STATUSES = ["pending", "accepted", "booked", "done"];
const BOOKED_STATUSES = ["pending", "accepted", "booked"];

/* --------------------------------------------------------------- dashboard */

export async function getDashboard(userId: string): Promise<DashboardData> {
  const chair = await requireChair(userId);
  const rows = await bookingsFor(chair.id);

  const users = await many(
    TABLES.users,
    rows.map((row) => str(row.user)),
  );
  const services = await many(
    TABLES.services,
    rows.map((row) => str(row.service)),
  );
  const payments = await paymentsFor(rows.map((row) => row.$id));

  const bookedIds = rows
    .filter((row) => BOOKED_STATUSES.includes(str(row.status)))
    .map((row) => row.$id);
  const doneIds = rows
    .filter((row) => str(row.status) === "done")
    .map((row) => row.$id);

  const dateOf = new Map(rows.map((row) => [row.$id, str(row.date)]));
  const paidForDates = (dates: Set<string>) =>
    paidFor(
      [...dateOf.entries()]
        .filter(([, date]) => dates.has(date))
        .map(([id]) => id),
      payments,
    );
  const now = today();
  const week = new Set(
    Array.from({ length: 7 }, (_, index) => addDays(now, -index)),
  );
  const month = new Set(
    Array.from({ length: 30 }, (_, index) => addDays(now, -index)),
  );

  const rowsIn = (set: Set<string>) => rows.filter((row) => set.has(str(row.date)));
  const bookedSum = (set: Set<string>) =>
    money(
      rowsIn(set)
        .filter((row) => BOOKED_STATUSES.includes(str(row.status)))
        .map((row) => num(row.price)),
    );
  const doneSum = (set: Set<string>) =>
    money(
      rowsIn(set)
        .filter((row) => str(row.status) === "done")
        .map((row) => num(row.price)),
    );

  const reviews = await listReviews(chair.id);
  const reviewRows = await many(
    TABLES.users,
    reviews.map((review) => review.user),
  );

  const calendar = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(now, index);
    const day = rows.filter(
      (row) =>
        str(row.date) === date && ACTIVE_STATUSES.includes(str(row.status)),
    );
    const appointments = day
      .map((row) => {
        const lite = toBookingLite(row);
        return appointment(
          lite,
          nameOf(services, lite.service, "Service"),
          nameOf(users, lite.user, "Member"),
        );
      })
      .sort((a, b) => a.start - b.start);
    return { date, total: appointments.length, appointments };
  });

  const activity = [...rows]
    .sort((a, b) => (a.$createdAt < b.$createdAt ? 1 : -1))
    .slice(0, 8)
    .map((row) => {
      const lite = toBookingLite(row);
      return {
        id: lite.id,
        when: lite.created.slice(0, 10),
        text: `${nameOf(users, lite.user)} — ${nameOf(services, lite.service, "Service")} · ${STATUS_LABEL[lite.status] ?? lite.status}`,
      };
    });

  return {
    chair: chair.name,
    counts: {
      today: rows.filter(
        (row) =>
          str(row.date) === now && ACTIVE_STATUSES.includes(str(row.status)),
      ).length,
      upcoming: rows.filter(
        (row) =>
          str(row.date) > now && BOOKED_STATUSES.includes(str(row.status)),
      ).length,
      pending: rows.filter((row) => str(row.status) === "pending").length,
      completed: doneIds.length,
      cancelled: rows.filter((row) => str(row.status) === "cancel").length,
    },
    revenue: {
      booked: money(
        rows
          .filter((row) => BOOKED_STATUSES.includes(str(row.status)))
          .map((row) => num(row.price)),
      ),
      completed: money(
        rows
          .filter((row) => str(row.status) === "done")
          .map((row) => num(row.price)),
      ),
      paid: paidFor([...bookedIds, ...doneIds], payments),
      weekBooked: bookedSum(week),
      weekCompleted: doneSum(week),
      weekPaid: paidForDates(week),
      monthBooked: bookedSum(month),
      monthCompleted: doneSum(month),
      monthPaid: paidForDates(month),
    },
    rating:
      reviews.length === 0
        ? 0
        : Math.round((money(reviews.map((review) => review.rate)) / reviews.length) * 10) / 10,
    reviews: reviews.slice(0, 5).map((review) => ({
      id: review.id,
      member: nameOf(reviewRows, review.user),
      rate: review.rate,
      note: review.note,
      date: review.created.slice(0, 10),
    })),
    calendar,
    activity,
    todayList: calendar[0]?.appointments ?? [],
  };
}

/* ---------------------------------------------------------------- services */

export async function listBusinessServices(userId: string) {
  const chair = await requireChair(userId);
  const rows = await listAll(TABLES.services, [
    Query.equal("barber", chair.id),
  ]);
  return rows
    .map(toService)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createBusinessService(
  userId: string,
  input: ServiceInput,
) {
  const chair = await requireChair(userId);
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: ID.unique(),
    data: { ...input, barber: chair.id },
  });
  return toService(row as Row);
}

export async function updateBusinessService(
  userId: string,
  id: string,
  patch: Partial<ServiceInput>,
) {
  const chair = await requireChair(userId);
  await ownedRow(TABLES.services, id, chair.id, "service");
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: id,
    data: patch,
  });
  return toService(row as Row);
}

export async function deleteBusinessService(userId: string, id: string) {
  const chair = await requireChair(userId);
  await ownedRow(TABLES.services, id, chair.id, "service");
  await adminDb().deleteDocument({
    databaseId: databaseId(),
    collectionId: TABLES.services,
    documentId: id,
  });
}

/* ---------------------------------------------------------------- customers */

async function customerMap(userId: string) {
  const chair = await requireChair(userId);
  const rows = await bookingsFor(chair.id);
  const users = await many(
    TABLES.users,
    rows.map((row) => str(row.user)),
  );
  const services = await many(
    TABLES.services,
    rows.map((row) => str(row.service)),
  );
  const notes = await listAll(EXTRA.notes, [
    Query.equal("barber", chair.id),
  ]);
  return { chair, rows, users, services, notes };
}

function toCustomer(
  id: string,
  rows: Row[],
  users: Row[],
  services: Row[],
  notes: Row[],
): Customer {
  const mine = rows.filter((row) => str(row.user) === id);
  const note = notes.find((row) => str(row.user) === id);
  return {
    id,
    name: nameOf(users, id),
    phone: str(users.find((row) => row.$id === id)?.phone),
    avatar: str(users.find((row) => row.$id === id)?.avatar),
    visits: mine.filter((row) => ACTIVE_STATUSES.includes(str(row.status))).length,
    completed: mine.filter((row) => str(row.status) === "done").length,
    spend: money(
      mine
        .filter((row) => str(row.status) === "done")
        .map((row) => num(row.price)),
    ),
    last: mine.reduce((last, row) => {
      const date = str(row.date);
      return date > last ? date : last;
    }, ""),
    services: [
      ...new Set(
        mine.map((row) => nameOf(services, str(row.service), "Service")),
      ),
    ],
    note: note ? str(note.note) : "",
    noteId: note?.$id ?? "",
  };
}

export async function listBusinessCustomers(
  userId: string,
): Promise<Customer[]> {
  const { rows, users, services, notes } = await customerMap(userId);
  const ids = [...new Set(rows.map((row) => str(row.user)))];
  return ids
    .map((id) => toCustomer(id, rows, users, services, notes))
    .sort((a, b) => (a.last === b.last ? b.visits - a.visits : a.last < b.last ? 1 : -1));
}

export async function getBusinessCustomer(
  userId: string,
  customerId: string,
): Promise<CustomerDetail> {
  const { rows, users, services, notes } = await customerMap(userId);
  if (!rows.some((row) => str(row.user) === customerId)) {
    throw new BarberBusinessError("That member is not a customer here.", "not_found", 404);
  }
  const bookings: CustomerBooking[] = rows
    .filter((row) => str(row.user) === customerId)
    .map((row) => {
      const lite = toBookingLite(row);
      return {
        id: lite.id,
        date: lite.date,
        time: `${String(Math.floor(lite.start / 60)).padStart(2, "0")}:${String(lite.start % 60).padStart(2, "0")}`,
        service: nameOf(services, lite.service, "Service"),
        status: STATUS_LABEL[lite.status] ?? lite.status,
        price: lite.price,
        note: lite.note,
      };
    })
    .sort((a, b) => (a.date === b.date ? -1 : a.date < b.date ? 1 : -1));

  return {
    customer: toCustomer(customerId, rows, users, services, notes),
    bookings,
  };
}

export async function saveCustomerNote(
  userId: string,
  customerId: string,
  note: string,
): Promise<PrivateNote | null> {
  const chair = await requireChair(userId);
  const rows = await listAll(TABLES.bookings, [
    Query.equal("barber", chair.id),
    Query.equal("user", customerId),
  ]);
  if (rows.length === 0) {
    throw new BarberBusinessError("That member is not a customer here.", "not_found", 404);
  }

  const existing = await listRows(EXTRA.notes, [
    Query.equal("barber", chair.id),
    Query.equal("user", customerId),
  ]);

  if (!note.trim()) {
    if (existing.length > 0) {
      await adminDb().deleteDocument({
        databaseId: databaseId(),
        collectionId: EXTRA.notes,
        documentId: existing[0].$id,
      });
    }
    return null;
  }

  if (existing.length > 0) {
    const row = await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: EXTRA.notes,
      documentId: existing[0].$id,
      data: { note: note.trim() },
    });
    return toNote(row as Row);
  }

  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.notes,
    documentId: ID.unique(),
    data: { barber: chair.id, user: customerId, note: note.trim() },
  });
  return toNote(row as Row);
}

/* ---------------------------------------------------------------- earnings */

export async function getEarnings(
  userId: string,
  filter: EarningsFilter,
): Promise<EarningsData> {
  const chair = await requireChair(userId);
  const services = await listBusinessServices(userId);

  if (filter.service) {
    const service = await getService(filter.service);
    if (!service || service.barber !== chair.id) {
      throw new BarberBusinessError("That service is not yours.", "forbidden", 403);
    }
  }

  const rows = (await bookingsFor(chair.id)).filter((row) => {
    const date = str(row.date);
    if (date < filter.from || date > filter.to) return false;
    if (filter.service && str(row.service) !== filter.service) return false;
    const status = str(row.status);
    if (filter.status === "done") return status === "done";
    if (filter.status === "booked") return BOOKED_STATUSES.includes(status);
    return status !== "cancel" && status !== "rejected";
  });

  const payments = await paymentsFor(rows.map((row) => row.$id));
  const ids = rows.map((row) => row.$id);
  const revenueBooked = money(
    rows
      .filter((row) => BOOKED_STATUSES.includes(str(row.status)))
      .map((row) => num(row.price)),
  );
  const revenueCompleted = money(
    rows
      .filter((row) => str(row.status) === "done")
      .map((row) => num(row.price)),
  );
  const revenuePaid = paidFor(ids, payments);

  const perUser = new Map<string, number>();
  for (const row of rows) {
    const id = str(row.user);
    perUser.set(id, (perUser.get(id) ?? 0) + 1);
  }
  const serviceCounts = new Map<string, { count: number; revenue: number }>();
  const timeCounts = new Map<number, number>();
  const dayCounts = new Map<string, { count: number; revenue: number }>();

  for (const row of rows) {
    const serviceId = str(row.service);
    const entry = serviceCounts.get(serviceId) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += num(row.price);
    serviceCounts.set(serviceId, entry);

    const hour = Math.floor(num(row.start) / 60);
    timeCounts.set(hour, (timeCounts.get(hour) ?? 0) + 1);

    const date = str(row.date);
    const day = dayCounts.get(date) ?? { count: 0, revenue: 0 };
    day.count += 1;
    day.revenue += num(row.price);
    dayCounts.set(date, day);
  }

  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  const reviews = await listReviews(chair.id);
  const rated = money(reviews.map((review) => review.rate));

  return {
    range: filter,
    services: services.map((service) => ({ id: service.id, name: service.name })),
    counts: {
      bookings: rows.length,
      completed: rows.filter((row) => str(row.status) === "done").length,
      cancelled: rows.filter((row) => str(row.status) === "cancel").length,
      customers: perUser.size,
      returning: [...perUser.values()].filter((count) => count > 1).length,
    },
    revenue: {
      booked: revenueBooked,
      completed: revenueCompleted,
      paid: revenuePaid,
    },
    averages: {
      booking: rows.length === 0 ? 0 : Math.round(revenueCompleted / rows.length),
      customer:
        perUser.size === 0 ? 0 : Math.round(revenueCompleted / perUser.size),
      rating: reviews.length === 0 ? 0 : Math.round((rated / reviews.length) * 10) / 10,
    },
    popularServices: [...serviceCounts.entries()]
      .map(([id, value]) => ({
        id,
        name: serviceNames.get(id) ?? "Service",
        count: value.count,
        revenue: value.revenue,
      }))
      .sort((a, b) => b.count - a.count),
    popularTimes: [...timeCounts.entries()]
      .map(([hour, count]) => ({
        hour,
        time: `${String(hour).padStart(2, "0")}:00`,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    byDay: [...dayCounts.entries()]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/* -------------------------------------------------------------- promotions */

export async function listPromotions(userId: string): Promise<Promotion[]> {
  const chair = await requireChair(userId);
  const rows = await listAll(EXTRA.promotions, [
    Query.equal("barber", chair.id),
  ]);
  return rows.map(toPromotion).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPromotion(
  userId: string,
  input: PromotionInput,
): Promise<Promotion> {
  const chair = await requireChair(userId);
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.promotions,
    documentId: ID.unique(),
    data: { ...input, barber: chair.id, uses: 0 },
  });
  return toPromotion(row as Row);
}

export async function updatePromotion(
  userId: string,
  id: string,
  patch: Partial<PromotionInput>,
): Promise<Promotion> {
  const chair = await requireChair(userId);
  await ownedRow(EXTRA.promotions, id, chair.id, "promotion");
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.promotions,
    documentId: id,
    data: patch,
  });
  return toPromotion(row as Row);
}

export async function deletePromotion(userId: string, id: string): Promise<void> {
  const chair = await requireChair(userId);
  await ownedRow(EXTRA.promotions, id, chair.id, "promotion");
  await adminDb().deleteDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.promotions,
    documentId: id,
  });
}

/* --------------------------------------------------------------- portfolio */

export async function listPortfolio(userId: string): Promise<PortfolioItem[]> {
  const chair = await requireChair(userId);
  const rows = await listAll(EXTRA.portfolio, [
    Query.equal("barber", chair.id),
  ]);
  return rows
    .map(toPortfolio)
    .sort((a, b) => (a.created < b.created ? 1 : -1));
}

export async function createPortfolio(
  userId: string,
  input: PortfolioInput,
): Promise<PortfolioItem> {
  const chair = await requireChair(userId);
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.portfolio,
    documentId: ID.unique(),
    data: { ...input, barber: chair.id },
  });
  return toPortfolio(row as Row);
}

export async function updatePortfolio(
  userId: string,
  id: string,
  patch: Partial<PortfolioInput>,
): Promise<PortfolioItem> {
  const chair = await requireChair(userId);
  await ownedRow(EXTRA.portfolio, id, chair.id, "photo");
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.portfolio,
    documentId: id,
    data: patch,
  });
  return toPortfolio(row as Row);
}

export async function deletePortfolio(userId: string, id: string): Promise<void> {
  const chair = await requireChair(userId);
  await ownedRow(EXTRA.portfolio, id, chair.id, "photo");
  await adminDb().deleteDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.portfolio,
    documentId: id,
  });
}

/* ----------------------------------------------------------- notifications */

export async function listBusinessNotifications(
  userId: string,
): Promise<NotificationRow[]> {
  await requireChair(userId);
  const rows = await listAll(EXTRA.notifications, [
    Query.equal("user", userId),
  ]);
  return rows
    .map(toNotification)
    .sort((a, b) => (a.created < b.created ? 1 : -1));
}

export async function markBusinessNotification(
  userId: string,
  id: string,
): Promise<NotificationRow> {
  await requireChair(userId);
  const row = await getRow(EXTRA.notifications, id);
  if (!row) {
    throw new BarberBusinessError("That notification no longer exists.", "not_found", 404);
  }
  if (str(row.user) !== userId) {
    throw new BarberBusinessError("That notification is not yours.", "forbidden", 403);
  }
  const updated = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: EXTRA.notifications,
    documentId: id,
    data: { state: "read" },
  });
  return toNotification(updated as Row);
}

export async function markAllBusinessNotifications(
  userId: string,
): Promise<number> {
  await requireChair(userId);
  const rows = await listAll(EXTRA.notifications, [
    Query.equal("user", userId),
    Query.equal("state", "new"),
  ]);
  await Promise.all(
    rows.map((row) =>
      adminDb().updateDocument({
        databaseId: databaseId(),
        collectionId: EXTRA.notifications,
        documentId: row.$id,
        data: { state: "read" },
      }),
    ),
  );
  return rows.length;
}

/* --------------------------------------------------------------- settings */

const PROFILE_KEYS = [
  "name",
  "title",
  "bio",
  "photo",
  "active",
  "shop",
  "address",
  "city",
  "years",
  "skills",
  "phone",
  "social",
  "facilities",
  "policy",
  "cover",
  "confirm",
  "featured",
] as const;

/** Update only business fields the caller sent. Never touches user or rating. */
export async function updateBusinessProfile(
  userId: string,
  patch: BusinessProfileInput,
) {
  const chair = await requireChair(userId);
  const data: Record<string, unknown> = {};
  for (const key of PROFILE_KEYS) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (Object.keys(data).length === 0) return chair;

  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.barbers,
    documentId: chair.id,
    data,
  });
  return {
    ...chair,
    ...Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value]),
    ),
  };
}

const PREFS_KEYS = {
  newBookings: "barber_new_bookings",
  cancellations: "barber_cancellations",
  reviews: "barber_reviews",
  reminders: "barber_reminders",
} as const;

function prefValue(prefs: Record<string, unknown>, key: keyof NotificationPrefs) {
  return bool(prefs[PREFS_KEYS[key]], true);
}

function accountFor(secret: string): Account {
  return new Account(createSessionClient(secret));
}

/** Notification preferences live in Appwrite user prefs, never in a table. */
export async function getBusinessPrefs(
  secret: string,
): Promise<NotificationPrefs> {
  const prefs = (await accountFor(secret).getPrefs()) as unknown as Record<
    string,
    unknown
  >;
  return {
    newBookings: prefValue(prefs, "newBookings"),
    cancellations: prefValue(prefs, "cancellations"),
    reviews: prefValue(prefs, "reviews"),
    reminders: prefValue(prefs, "reminders"),
  };
}

export async function updateBusinessPrefs(
  secret: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const data: Record<string, boolean> = {};
  for (const key of Object.keys(PREFS_KEYS) as Array<keyof NotificationPrefs>) {
    if (patch[key] !== undefined) data[PREFS_KEYS[key]] = patch[key];
  }
  if (Object.keys(data).length > 0) {
    await accountFor(secret).updatePrefs({ prefs: data });
  }
  return getBusinessPrefs(secret);
}
