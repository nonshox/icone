import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { audit } from "./audit";
import {
  bool,
  clean,
  count as countRows,
  create,
  first,
  get,
  list,
  num,
  str,
  update,
  type Row,
} from "./crud";
import { toBusiness, updateBusiness } from "./business";
import { updateBarber } from "./professional";
import { setReviewState, refreshBarberRating } from "./review";
import { shopClock } from "./time";
import { toApplication } from "./application";
import type { Application, Business, Report, Ticket } from "./types";

/**
 * Platform administration.
 *
 * Every function here assumes the caller has already been checked as a
 * platform admin by `requireAdmin()`. Sensitive ones write an audit row.
 */

/* ------------------------------------------------------------ settings */

export type PlatformSettings = {
  /** Allow anyone to start a professional application. */
  applicationsOpen: boolean;
  /** Publish approved businesses without a manual verification pass. */
  autoVerify: boolean;
  /** Hide the marketplace behind a maintenance message. */
  maintenance: boolean;
  /** Days a customer can book ahead. */
  horizon: number;
  /** Minutes of lead time before an appointment can start. */
  lead: number;
  /** Shown on the sign-in page. */
  notice: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  applicationsOpen: true,
  autoVerify: false,
  maintenance: false,
  horizon: 60,
  lead: 30,
  notice: "",
};

const SETTINGS_ID = "platform";

export async function getSettings(): Promise<PlatformSettings> {
  const row = await get(TABLES.settings, SETTINGS_ID);
  if (!row || typeof row.data !== "string") return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.data) as Partial<PlatformSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(
  patch: Partial<PlatformSettings>,
  actor: string,
): Promise<PlatformSettings> {
  const current = await getSettings();
  const next: PlatformSettings = { ...current, ...patch };

  const data = JSON.stringify(next);
  const existing = await get(TABLES.settings, SETTINGS_ID);

  if (existing) {
    await update(TABLES.settings, SETTINGS_ID, { data, updatedby: actor });
  } else {
    await create(
      TABLES.settings,
      { data, updatedby: actor },
      SETTINGS_ID,
    );
  }

  await audit({
    actor,
    action: "settings.change",
    kind: "platform",
    target: SETTINGS_ID,
    detail: Object.keys(patch).join(","),
  });

  return next;
}

/* ------------------------------------------------------------ overview */

export type AdminOverview = {
  users: number;
  barbers: number;
  businesses: number;
  branches: number;
  applications: number;
  pendingApplications: number;
  bookings: number;
  todayBookings: number;
  reviews: number;
  flaggedReviews: number;
  openReports: number;
  openTickets: number;
  pendingInvites: number;
};

export async function overview(): Promise<AdminOverview> {
  const clock = shopClock();

  const [
    users,
    barbers,
    businesses,
    branches,
    applications,
    pending,
    bookings,
    today,
    reviews,
    flagged,
    reports,
    tickets,
    invites,
  ] = await Promise.all([
    count(TABLES.users, []),
    count(TABLES.barbers, []),
    count(TABLES.businesses, []),
    count(TABLES.branches, []),
    count(TABLES.applications, []),
    count(TABLES.applications, [Query.equal("state", "submitted")]),
    count(TABLES.bookings, []),
    count(TABLES.bookings, [Query.equal("date", clock.date)]),
    count(TABLES.reviews, []),
    count(TABLES.reviews, [Query.notEqual("state", "open")]),
    count(TABLES.reports, [Query.equal("state", "open")]),
    count(TABLES.tickets, [Query.equal("state", "open")]),
    count(TABLES.invites, [Query.equal("state", "pending")]),
  ]);

  return {
    users,
    barbers,
    businesses,
    branches,
    applications,
    pendingApplications: pending,
    bookings,
    todayBookings: today,
    reviews,
    flaggedReviews: flagged,
    openReports: reports,
    openTickets: tickets,
    pendingInvites: invites,
  };
}

async function count(table: string, queries: string[]): Promise<number> {
  return countRows(table, queries);
}

/* --------------------------------------------------------------- users */

export type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: string;
  avatar: string;
  state: string;
  locale: string;
  created: string;
  barbers: number;
  businesses: number;
};

export async function listUsers(filter: {
  q?: string;
  state?: string;
  limit?: number;
}): Promise<AdminUser[]> {
  const queries: string[] = [];
  if (filter.state) queries.push(Query.equal("state", filter.state));

  const rows = await list(TABLES.users, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(200, filter.limit ?? 100)),
  ]);

  const users = rows.map((row) => ({
    id: row.$id,
    name: str(row.name),
    phone: str(row.phone),
    role: str(row.role, "client"),
    avatar: str(row.avatar),
    state: str(row.state, "active"),
    locale: str(row.locale, "uz"),
    created: row.$createdAt,
    barbers: 0,
    businesses: 0,
  }));

  if (!filter.q) return users;
  const needle = filter.q.toLowerCase();
  return users.filter(
    (user) =>
      user.name.toLowerCase().includes(needle) ||
      user.phone.includes(needle) ||
      user.id.toLowerCase().includes(needle),
  );
}

/** Suspend or restore an account everywhere it can act. */
export async function setUserState(
  userId: string,
  state: "active" | "suspended",
  actor: string,
  note = "",
): Promise<void> {
  await update(TABLES.users, userId, { state });

  const barberRows = await list(TABLES.barbers, [
    Query.equal("user", userId),
    Query.limit(10),
  ]);
  await Promise.all(
    barberRows.map((row) =>
      updateBarber(row.$id, {
        state: state === "suspended" ? "suspended" : "active",
        active: state !== "suspended",
      }),
    ),
  );

  await audit({
    actor,
    action: state === "suspended" ? "user.suspend" : "user.restore",
    kind: "user",
    target: userId,
    detail: note,
  });
}

/* --------------------------------------------------------- businesses */

export type AdminBusiness = Business & {
  ownerName: string;
  staff: number;
  branches: number;
};

export async function listBusinesses(filter: {
  state?: string;
  q?: string;
  limit?: number;
}): Promise<AdminBusiness[]> {
  const queries: string[] = [];
  if (filter.state) queries.push(Query.equal("state", filter.state));

  const rows = await list(TABLES.businesses, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(200, filter.limit ?? 100)),
  ]);

  const businesses = rows.map(toBusiness);
  const owners = await namesOf(businesses.map((row) => row.owner));

  const out: AdminBusiness[] = [];
  for (const business of businesses) {
    const [staff, branches] = await Promise.all([
      count(TABLES.memberships, [Query.equal("business", business.id)]),
      count(TABLES.branches, [Query.equal("business", business.id)]),
    ]);
    out.push({
      ...business,
      ownerName: owners.get(business.owner) ?? "",
      staff,
      branches,
    });
  }

  if (!filter.q) return out;
  const needle = filter.q.toLowerCase();
  return out.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      row.city.toLowerCase().includes(needle) ||
      row.ownerName.toLowerCase().includes(needle),
  );
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await list(TABLES.users, [Query.equal("$id", unique), Query.limit(100)]);
  return new Map(rows.map((row) => [row.$id, str(row.name)]));
}

/** Mark a business as checked by the platform. */
export async function verifyBusiness(
  businessId: string,
  verified: boolean,
  actor: string,
): Promise<void> {
  await updateBusiness(businessId, { verified });
  await audit({
    actor,
    action: "business.verify",
    kind: "business",
    target: businessId,
    detail: verified ? "verified" : "unverified",
  });
}

export async function setBusinessState(
  businessId: string,
  state: Business["state"],
  actor: string,
  note = "",
): Promise<void> {
  await updateBusiness(businessId, { state, active: state === "active" });
  await audit({
    actor,
    action: "business.suspend",
    kind: "business",
    target: businessId,
    detail: `${state} ${note}`.trim(),
  });
}

/** Independently operating professionals, for the marketplace queue. */
export async function listProfessionals(filter: {
  verified?: boolean;
  q?: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  const rows = await list(TABLES.barbers, [
    Query.equal("business", ""),
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(200, filter.limit ?? 100)),
  ]);

  const professionals = rows.map((row) => ({
    id: row.$id,
    name: str(row.name),
    user: str(row.user),
    city: str(row.city),
    district: str(row.district),
    rating: num(row.rating),
    verified: bool(row.verified),
    state: str(row.state, "active"),
    active: bool(row.active, true),
    created: row.$createdAt,
  }));

  if (typeof filter.verified === "boolean") {
    return professionals.filter((row) => row.verified === filter.verified);
  }
  if (filter.q) {
    const needle = filter.q.toLowerCase();
    return professionals.filter((row) => String(row.name).toLowerCase().includes(needle));
  }
  return professionals;
}

export async function verifyProfessional(
  barberId: string,
  verified: boolean,
  actor: string,
): Promise<void> {
  await updateBarber(barberId, { verified });
  await audit({
    actor,
    action: "business.verify",
    kind: "barber",
    target: barberId,
    detail: verified ? "verified" : "unverified",
  });
}

/* ------------------------------------------------- reports and tickets */

export function toReport(row: Row): Report {
  return {
    id: row.$id,
    reporter: str(row.reporter),
    kind: (str(row.kind, "user") || "user") as Report["kind"],
    target: str(row.target),
    note: str(row.note),
    detail: str(row.detail),
    state: (str(row.state, "open") || "open") as Report["state"],
    actor: str(row.actor),
    created: row.$createdAt,
  };
}

export function toTicket(row: Row): Ticket {
  return {
    id: row.$id,
    user: str(row.user),
    topic: str(row.topic),
    body: str(row.body),
    reply: str(row.reply),
    state: (str(row.state, "open") || "open") as Ticket["state"],
    actor: str(row.actor),
    created: row.$createdAt,
  };
}

export async function listReports(state?: Report["state"]): Promise<Report[]> {
  const queries: string[] = [];
  if (state) queries.push(Query.equal("state", state));

  const rows = await list(TABLES.reports, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return rows.map(toReport);
}

export async function resolveReport(
  id: string,
  state: Report["state"],
  actor: string,
  detail = "",
): Promise<void> {
  await update(TABLES.reports, id, { state, actor, detail: clean(detail, 512) });
  await audit({
    actor,
    action: "report.resolve",
    kind: "report",
    target: id,
    detail: `${state} ${detail}`.trim(),
  });
}

export async function createReport(input: {
  reporter: string;
  kind: Report["kind"];
  target: string;
  note: string;
}): Promise<Report> {
  const row = await create(TABLES.reports, {
    reporter: input.reporter,
    kind: input.kind,
    target: input.target,
    note: clean(input.note, 512),
    detail: "",
    state: "open",
    actor: "",
  });
  return toReport(row);
}

export async function listTickets(state?: Ticket["state"]): Promise<Ticket[]> {
  const queries: string[] = [];
  if (state) queries.push(Query.equal("state", state));

  const rows = await list(TABLES.tickets, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return rows.map(toTicket);
}

export async function createTicket(input: {
  user: string;
  topic: string;
  body: string;
}): Promise<Ticket> {
  const row = await create(TABLES.tickets, {
    user: input.user,
    topic: clean(input.topic, 64),
    body: clean(input.body, 1024),
    reply: "",
    state: "open",
    actor: "",
  });
  return toTicket(row);
}

export async function replyTicket(
  id: string,
  reply: string,
  actor: string,
): Promise<void> {
  await update(TABLES.tickets, id, {
    reply: clean(reply, 1024),
    state: "answered",
    actor,
  });
  await audit({ actor, action: "ticket.reply", kind: "ticket", target: id });
}

export async function closeTicket(id: string, actor: string): Promise<void> {
  await update(TABLES.tickets, id, { state: "closed", actor });
}

/* ------------------------------------------------- moderation shortcuts */

/** Hide or restore a review as part of moderation. */
export async function moderateReview(
  id: string,
  state: "open" | "hidden",
  actor: string,
): Promise<void> {
  const review = await setReviewState(id, state);
  await refreshBarberRating(review.barber);
  await audit({
    actor,
    action: state === "hidden" ? "review.hide" : "review.restore",
    kind: "review",
    target: id,
  });
}

export async function applicationsQueue(limit = 100): Promise<Application[]> {
  const rows = await list(TABLES.applications, [
    Query.orderDesc("$createdAt"),
    Query.limit(limit),
  ]);
  return rows.map(toApplication);
}

/* ------------------------------------------------------ reference data */

export async function createCategory(name: string, actor: string): Promise<void> {
  const trimmed = clean(name, 32);
  if (!trimmed) return;

  const existing = await first(TABLES.categories, [Query.equal("name", trimmed)]);
  if (existing) {
    await update(TABLES.categories, existing.$id, { active: true });
    return;
  }

  await create(TABLES.categories, { name: trimmed, active: true });
  await audit({ actor, action: "settings.change", kind: "category", target: trimmed });
}

export async function toggleCategory(id: string, active: boolean): Promise<void> {
  await update(TABLES.categories, id, { active });
}

export async function createPlace(input: {
  name: string;
  kind: "city" | "district";
  parent?: string;
  ru?: string;
  en?: string;
  lat?: number;
  lng?: number;
}): Promise<void> {
  const name = clean(input.name, 64);
  if (!name) return;

  await create(TABLES.places, {
    name,
    ru: clean(input.ru ?? "", 64),
    en: clean(input.en ?? "", 64),
    kind: input.kind,
    parent: input.parent ?? "",
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    sort: 0,
    active: true,
  });
}

export async function togglePlace(id: string, active: boolean): Promise<void> {
  await update(TABLES.places, id, { active });
}

/* ------------------------------------------------------------- export */

export type ExportRow = Record<string, string | number>;

/**
 * Turn appointments into CSV for the business owner who asked.
 *
 * Only the owner's own rows are ever selected — the caller passes the
 * business id it has already authorized — and nothing financial is included,
 * because the platform never handles money.
 */
export async function exportBookings(businessId: string, range: { from: string; to: string }): Promise<string> {
  const rows = await list(TABLES.bookings, [
    Query.equal("business", businessId),
    Query.greaterThanEqual("date", range.from),
    Query.lessThanEqual("date", range.to),
    Query.orderAsc("date"),
    Query.limit(1000),
  ]);

  const header = [
    "date",
    "start",
    "end",
    "status",
    "source",
    "barber",
    "service",
    "price",
    "note",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        str(row.date),
        str(row.start),
        str(row.end),
        str(row.status),
        str(row.source, "online"),
        str(row.barber),
        str(row.service),
        num(row.price),
        csv(str(row.note)),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function csv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
