import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, list, num, str, type Row } from "./crud";
import { toBooking } from "./booking";
import { addDays, shopClock } from "./time";
import type { Booking } from "./types";

/**
 * Operational analytics.
 *
 * Everything here is counted from real appointments — there is no revenue,
 * no platform fee and no invented trend line. A number appears only when the
 * underlying rows exist to support it.
 */

export type Range = {
  from: string;
  to: string;
};

export type StatsFilter = {
  range?: Range;
  barber?: string;
  business?: string;
  branch?: string;
  service?: string;
};

export type Histogram = Array<{ label: string; value: number }>;

export type Stats = {
  range: Range;
  total: number;
  completed: number;
  cancelled: number;
  rejected: number;
  noShow: number;
  pending: number;
  confirmed: number;
  /** Completed + no-show, i.e. everything that actually happened. */
  held: number;
  noShowRate: number;
  cancelRate: number;
  newCustomers: number;
  returningCustomers: number;
  retention: number;
  perDay: number;
  byStatus: Histogram;
  byDay: Histogram;
  byService: Histogram;
  byBarber: Histogram;
  byBranch: Histogram;
};

/** A rolling window ending today. */
export function lastDays(days: number): Range {
  const clock = shopClock();
  return { from: addDays(clock.date, -(days - 1)), to: clock.date };
}

export const RANGES = { week: 7, month: 30, quarter: 90 } as const;
export type RangeKey = keyof typeof RANGES;

/* --------------------------------------------------------------- loading */

async function loadBookings(filter: StatsFilter): Promise<Booking[]> {
  const range = filter.range ?? lastDays(30);

  const base: string[] = [
    Query.greaterThanEqual("date", range.from),
    Query.lessThanEqual("date", range.to),
  ];
  if (filter.barber) base.push(Query.equal("barber", filter.barber));
  if (filter.business) base.push(Query.equal("business", filter.business));
  if (filter.branch) base.push(Query.equal("branch", filter.branch));

  // Page through the window: a capped query silently understates every rate.
  const rows: Row[] = [];
  const page = 200;
  for (let offset = 0; offset < 5000; offset += page) {
    const batch = await list(TABLES.bookings, [...base, Query.limit(page), Query.offset(offset)]);
    rows.push(...batch);
    if (batch.length < page) break;
  }
  let bookings = rows.map(toBooking);

  if (filter.service) {
    bookings = bookings.filter((booking) =>
      (booking.items.length > 0 ? booking.items : [booking.service]).includes(filter.service!),
    );
  }

  return bookings;
}

/* ------------------------------------------------------------ aggregation */

function histogram<T extends string | number>(
  rows: Booking[],
  key: (booking: Booking) => T,
): Map<T, number> {
  const out = new Map<T, number>();
  for (const row of rows) {
    const k = key(row);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function toHistogram(counts: Map<string, number>): Histogram {
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Count one set of appointments into the shape every dashboard renders.
 *
 * `byBarber` and `byBranch` are resolved from the rows themselves so a
 * professional who left still shows up in historical numbers.
 */
export async function computeStats(filter: StatsFilter = {}): Promise<Stats> {
  const range = filter.range ?? lastDays(30);
  const bookings = await loadBookings(filter);

  const byStatus = histogram(bookings, (row) => row.status);

  const completed = byStatus.get("done") ?? 0;
  const noShow = byStatus.get("noshow") ?? 0;
  const cancelled = (byStatus.get("cancelled") ?? 0) + (byStatus.get("rejected") ?? 0);
  const held = completed + noShow;
  const total = bookings.length;

  // Customers are counted once per window: people who came at least twice
  // are the returning ones.
  const visits = histogram(bookings, (row) => row.user || row.client || row.id);
  const repeatCustomers = [...visits.values()].filter((count) => count > 1).length;
  const distinctCustomers = visits.size;

  const days = Math.max(1, daysBetween(range.from, range.to));
  const average = Math.round((total / days) * 10) / 10;

  const byDayCounts = histogram(bookings, (row) => row.date);
  const byDay: Histogram = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(range.from, offset);
    byDay.push({ label: date, value: byDayCounts.get(date) ?? 0 });
  }

  // A visit can contain several services; every one of them is popular.
  const byServiceCounts = new Map<string, number>();
  for (const booking of bookings) {
    for (const id of booking.items.length > 0 ? booking.items : [booking.service]) {
      if (!id) continue;
      byServiceCounts.set(id, (byServiceCounts.get(id) ?? 0) + 1);
    }
  }
  const byBarberCounts = histogram(bookings, (row) => row.barber);
  const byBranchCounts = histogram(bookings, (row) => row.branch || "—");

  const [barberNames, serviceNames] = await Promise.all([
    resolveNames(TABLES.barbers, [...byBarberCounts.keys()]),
    resolveNames(TABLES.services, [...byServiceCounts.keys()]),
  ]);

  return {
    range,
    total,
    completed,
    cancelled,
    rejected: byStatus.get("rejected") ?? 0,
    noShow,
    pending: byStatus.get("pending") ?? 0,
    confirmed: byStatus.get("confirmed") ?? 0,
    held,
    noShowRate: held > 0 ? Math.round((noShow / held) * 1000) / 10 : 0,
    cancelRate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
    newCustomers: Math.max(0, distinctCustomers - repeatCustomers),
    returningCustomers: repeatCustomers,
    retention:
      distinctCustomers > 0 ? Math.round((repeatCustomers / distinctCustomers) * 1000) / 10 : 0,
    perDay: average,
    byStatus: toHistogram(new Map([...byStatus].map(([k, v]) => [String(k), v]))),
    byDay,
    byService: toHistogram(
      new Map([...byServiceCounts].map(([k, v]) => [serviceNames.get(k) ?? "Service", v])),
    ),
    byBarber: toHistogram(
      new Map([...byBarberCounts].map(([k, v]) => [barberNames.get(k) ?? "Barber", v])),
    ),
    byBranch: toHistogram(new Map([...byBranchCounts].map(([k, v]) => [String(k), v]))),
  };
}

async function resolveNames(table: string, ids: string[]): Promise<Map<string, string>> {
  const unique = ids.filter(Boolean);
  if (unique.length === 0) return new Map();

  const rows = await list(table, [Query.equal("$id", unique), Query.limit(100)]);
  return new Map(rows.map((row) => [row.$id, str(row.name)]));
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/* ---------------------------------------------------------- dashboards */

export type DashboardStats = {
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
  customers: number;
  returning: number;
  rating: number;
  views: number;
  /** Share of today's appointments already finished. */
  progress: number;
};

/**
 * The numbers on a professional's home screen.
 *
 * Only counts that mean something for one person are shown; an independent
 * barber never sees headcount or branch tiles.
 */
export async function barberDashboard(
  barberId: string,
  options: { rating?: number; views?: number } = {},
): Promise<DashboardStats> {
  const clock = shopClock();
  const horizon = addDays(clock.date, 30);

  const [todayRows, upcomingRows, historyRows] = await Promise.all([
    list(TABLES.bookings, [
      Query.equal("barber", barberId),
      Query.equal("date", clock.date),
      Query.limit(100),
    ]),
    list(TABLES.bookings, [
      Query.equal("barber", barberId),
      Query.greaterThanEqual("date", addDays(clock.date, 1)),
      Query.lessThanEqual("date", horizon),
      Query.limit(200),
    ]),
    list(TABLES.bookings, [
      Query.equal("barber", barberId),
      Query.lessThan("date", clock.date),
      Query.orderDesc("date"),
      Query.limit(200),
    ]),
  ]);

  const today = todayRows.map(toBooking).filter((row) => row.status !== "cancelled" && row.status !== "rejected");
  const upcoming = upcomingRows
    .map(toBooking)
    .filter((row) => row.status === "pending" || row.status === "confirmed");
  const history = historyRows.map(toBooking);

  const customers = new Set(history.map((row) => row.user || row.client).filter(Boolean));
  const repeat = countRepeats(history);

  const finished = today.filter((row) => row.status === "done" || row.status === "noshow").length;

  return {
    today: today.length,
    upcoming: upcoming.length,
    pending: today.filter((row) => row.status === "pending").length,
    completed: history.filter((row) => row.status === "done").length,
    customers: customers.size,
    returning: repeat,
    rating: options.rating ?? 0,
    views: options.views ?? 0,
    progress: today.length > 0 ? Math.round((finished / today.length) * 100) : 0,
  };
}

function countRepeats(rows: Booking[]): number {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.user || row.client;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

export type TeamDashboard = DashboardStats & {
  staff: number;
  availableToday: number;
  workload: Histogram;
  branches: number;
};

/** The owner's home screen: the whole business, not one chair. */
export async function businessDashboard(businessId: string): Promise<TeamDashboard> {
  const stats = await computeStats({ business: businessId, range: lastDays(30) });

  const [staffRows, branchRows, clock] = await Promise.all([
    list(TABLES.barbers, [
      Query.equal("business", businessId),
      Query.equal("active", true),
      Query.limit(100),
    ]),
    list(TABLES.branches, [Query.equal("business", businessId), Query.limit(50)]),
    Promise.resolve(shopClock()),
  ]);

  const staff = staffRows.map((row) => str(row.$id));
  const activeStaff = staffRows.filter(
    (row) => str(row.state, "active") === "active" && bool(row.active, false),
  ).length;

  // Who is actually working today, out of everyone on the books.
  const todayRows = await list(TABLES.bookings, [
    Query.equal("business", businessId),
    Query.equal("date", clock.date),
    Query.limit(200),
  ]);

  const working = new Set(
    todayRows
      .map(toBooking)
      .filter((row) => row.status === "confirmed" || row.status === "pending" || row.status === "done")
      .map((row) => row.barber),
  );

  const todayAppointments = todayRows
    .map(toBooking)
    .filter((row) => row.status !== "cancelled" && row.status !== "rejected");

  const rating = staffRows.length
    ? Math.round(
        (staffRows.reduce((sum, row) => sum + num(row.rating), 0) / staffRows.length) * 10,
      ) / 10
    : 0;

  const views = staffRows.reduce((sum, row) => sum + num(row.views), 0);

  const base = staff[0] ? await barberDashboard(staff[0], { rating, views }) : emptyDashboard();

  return {
    ...base,
    today: todayAppointments.length,
    pending: todayAppointments.filter((row) => row.status === "pending").length,
    upcoming: stats.confirmed + stats.pending,
    completed: stats.completed,
    customers: stats.newCustomers + stats.returningCustomers,
    returning: stats.returningCustomers,
    progress:
      todayAppointments.length > 0
        ? Math.round(
            (todayAppointments.filter((row) => row.status === "done" || row.status === "noshow").length /
              todayAppointments.length) *
              100,
          )
        : 0,
    staff: activeStaff,
    availableToday: working.size,
    workload: stats.byBarber,
    branches: branchRows.length,
    rating,
    views,
  };
}

function emptyDashboard(): DashboardStats {
  return {
    today: 0,
    upcoming: 0,
    pending: 0,
    completed: 0,
    customers: 0,
    returning: 0,
    rating: 0,
    views: 0,
    progress: 0,
  };
}

/* ------------------------------------------------------------- exports */

/** Popular services, most booked first. */
export async function popularServices(filter: StatsFilter = {}, limit = 5): Promise<Histogram> {
  const stats = await computeStats(filter);
  return stats.byService.slice(0, limit);
}

/** Average appointments per day over the window. */
export function appointmentsPerDay(stats: Stats): number {
  return stats.perDay;
}

/** Share of customers who came back inside the window. */
export function retentionRate(stats: Stats): number {
  return stats.retention;
}

/** Every professional in a business, resolved for the workload chart. */
export async function teamNames(businessId: string): Promise<Map<string, string>> {
  const rows = await list(TABLES.barbers, [
    Query.equal("business", businessId),
    Query.limit(100),
  ]);
  return new Map(rows.map((row) => [row.$id, str(row.name)]));
}
