import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { audit } from "./audit";
import { clean, create, first, list, str, update, type Row } from "./crud";
import { createBranch, createBusiness, updateBusiness } from "./business";
import { notify } from "./notify";
import { addMember } from "./team";
import { createBarber, barberForUser, updateBarber } from "./professional";
import { shopClock } from "./time";
import type { Application, AppState, ApplicationStep } from "./types";

/**
 * Professional onboarding and the platform's review of it.
 *
 * One application per account (the unique index on `user` enforces it) and
 * one of two shapes: model `a` is an independent barber, model `b` is a
 * barbershop with a team. Everything an applicant types is kept in `payload`
 * so they can leave mid-flow and come back to it.
 */

const SIZES = {
  name: 64,
  shop: 64,
  city: 64,
  district: 64,
  address: 160,
  phone: 32,
  bio: 1024,
  note: 512,
  reason: 512,
  payload: 16384,
  history: 8192,
};

/** Everything an applicant can enter, stored as one JSON blob. */
export type ApplicationPayload = {
  model: "a" | "b";
  name: string;
  shop?: string;
  photo?: string;
  cover?: string;
  bio?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  lat?: number;
  lng?: number;
  years?: number;
  langs?: string;
  skills?: string;
  policy?: string;
  confirm?: boolean;
  seats?: number;
  services?: Array<{ name: string; price: number; time: number; note?: string }>;
  hours?: Array<{ day: number; start: number; end: number }>;
  breaks?: Array<{ day: number; start: number; end: number }>;
  portfolio?: string[];
  step?: string;
};

export function toApplication(row: Row): Application {
  return {
    id: row.$id,
    user: str(row.user),
    model: str(row.model, "a") === "b" ? "b" : "a",
    state: normalizeState(str(row.state, "draft")),
    target: str(row.target),
    name: str(row.name),
    shop: str(row.shop),
    city: str(row.city, "Tashkent"),
    district: str(row.district),
    address: str(row.address),
    phone: str(row.phone),
    bio: str(row.bio),
    note: str(row.note),
    reason: str(row.reason),
    history: parseHistory(row.history),
    created: row.$createdAt,
  };
}

/**
 * The old table only knew `pending`. Read it as `submitted` so a row written
 * before the review workflow still shows up in the queue.
 */
function normalizeState(value: string): AppState {
  const known: AppState[] = [
    "draft",
    "submitted",
    "review",
    "info",
    "approved",
    "rejected",
    "suspended",
  ];
  if (value === "pending") return "submitted";
  return (known as string[]).includes(value) ? (value as AppState) : "draft";
}

function parseHistory(value: unknown): ApplicationStep[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        state: normalizeState(String(row.state ?? "draft")),
        at: String(row.at ?? ""),
        by: String(row.by ?? ""),
        note: String(row.note ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export function payloadOf(application: Application, raw: Row): ApplicationPayload {
  if (typeof raw.payload !== "string" || !raw.payload) {
    return { model: application.model, name: application.name };
  }
  try {
    const parsed = JSON.parse(raw.payload) as ApplicationPayload;
    return { ...parsed, model: application.model };
  } catch {
    return { model: application.model, name: application.name };
  }
}

/* --------------------------------------------------------------- reading */

export async function applicationFor(userId: string): Promise<Application | null> {
  const row = await first(TABLES.applications, [Query.equal("user", userId)]);
  return row ? toApplication(row) : null;
}

/** The raw row, when a caller also needs the draft payload. */
export async function applicationRow(userId: string): Promise<Row | null> {
  return first(TABLES.applications, [Query.equal("user", userId)]);
}

export type ApplicationFilter = {
  state?: AppState;
  model?: "a" | "b";
  q?: string;
  limit?: number;
};

export async function listApplications(
  filter: ApplicationFilter = {},
): Promise<Application[]> {
  const queries: string[] = [];
  if (filter.state) queries.push(Query.equal("state", filter.state));
  if (filter.model) queries.push(Query.equal("model", filter.model));

  const rows = await list(TABLES.applications, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(200, filter.limit ?? 100)),
  ]);

  const applications = rows.map(toApplication);
  if (!filter.q) return applications;

  const needle = filter.q.toLowerCase();
  return applications.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      row.shop.toLowerCase().includes(needle) ||
      row.phone.includes(needle) ||
      row.city.toLowerCase().includes(needle),
  );
}

export async function countApplications(state: AppState): Promise<number> {
  const rows = await list(TABLES.applications, [
    Query.equal("state", state),
    Query.limit(100),
  ]);
  return rows.length;
}

/* --------------------------------------------------------------- writing */

/** Open the draft for an account, creating it on first use. */
export async function openApplication(
  userId: string,
  model: "a" | "b" = "a",
): Promise<Application> {
  const existing = await applicationFor(userId);
  if (existing) return existing;

  const row = await create(TABLES.applications, {
    user: userId,
    model,
    state: "draft",
    target: "",
    name: "",
    shop: "",
    city: "Tashkent",
    district: "",
    address: "",
    phone: "",
    bio: "",
    note: "",
    reason: "",
    history: "[]",
    payload: "",
  });

  return toApplication(row);
}

/** Save progress. Any field may be omitted while the applicant is mid-flow. */
export async function saveDraft(
  userId: string,
  patch: Partial<ApplicationPayload>,
): Promise<Application> {
  const current = await openApplication(userId, patch.model ?? "a");
  const raw = await applicationRow(userId);
  const payload = raw ? payloadOf(current, raw) : { model: current.model, name: "" };

  const merged: ApplicationPayload = {
    ...payload,
    ...patch,
    model: patch.model ?? payload.model,
  };

  const data: Record<string, unknown> = {
    payload: JSON.stringify(merged).slice(0, SIZES.payload),
    model: merged.model,
    name: clean(merged.name, SIZES.name),
    shop: clean(merged.shop ?? "", SIZES.shop),
    city: clean(merged.city ?? "Tashkent", SIZES.city),
    district: clean(merged.district ?? "", SIZES.district),
    address: clean(merged.address ?? "", SIZES.address),
    phone: clean(merged.phone ?? "", SIZES.phone),
    bio: clean(merged.bio ?? "", SIZES.bio),
  };

  const row = await update(TABLES.applications, current.id, data);
  return toApplication(row);
}

/** Move a draft into the review queue. Validation happens before this. */
export async function submitApplication(userId: string): Promise<Application> {
  const current = await applicationFor(userId);
  if (!current) throw new Error("no_application");
  if (current.state !== "draft" && current.state !== "info" && current.state !== "rejected") {
    return current;
  }

  const row = await update(TABLES.applications, current.id, {
    state: "submitted",
    reason: "",
  });

  const application = toApplication(row);
  await record(application, "submitted", "", "Submitted for review");
  await audit({
    actor: userId,
    action: "application.submit",
    kind: "application",
    target: application.id,
    detail: application.model === "b" ? "barbershop" : "independent",
  });

  return application;
}

async function record(
  application: Application,
  state: AppState,
  by: string,
  note: string,
): Promise<void> {
  const raw = await first(TABLES.applications, [Query.equal("$id", application.id)]);
  const history = raw ? parseHistory(raw.history) : application.history;

  history.push({ state, at: shopClock().date, by, note: clean(note, SIZES.note) });

  await update(TABLES.applications, application.id, {
    history: JSON.stringify(history).slice(0, SIZES.history),
  });
}

/* ------------------------------------------------------------- reviewing */

export type Decision = "approve" | "reject" | "request" | "suspend";

export type DecisionResult =
  | { ok: true; application: Application }
  | { ok: false; status: number; code: string; message: string };

/**
 * Act on an application.
 *
 * Approving is the only step that creates the public professional or business
 * record — nothing a customer can discover exists before a human says so.
 */
export async function decideApplication(input: {
  id: string;
  decision: Decision;
  by: string;
  note?: string;
}): Promise<DecisionResult> {
  const raw = await first(TABLES.applications, [Query.equal("$id", input.id)]);
  if (!raw) {
    return { ok: false, status: 404, code: "not_found", message: "That application no longer exists." };
  }

  const application = toApplication(raw);
  const payload = payloadOf(application, raw);

  if (input.decision === "approve" && !["submitted", "review"].includes(application.state)) {
    return {
      ok: false,
      status: 409,
      code: "bad_state",
      message: "Only an application under review can be approved.",
    };
  }
  if (input.decision === "suspend" && application.state !== "approved") {
    return {
      ok: false,
      status: 409,
      code: "bad_state",
      message: "Only an approved account can be suspended.",
    };
  }

  switch (input.decision) {
    case "approve": {
      const target = await publish(application, payload);

      const row = await update(TABLES.applications, application.id, {
        state: "approved",
        target: target.id,
        reason: "",
      });
      const approved = toApplication(row);
      await record(approved, "approved", input.by, input.note ?? "Approved");

      await notify({
        userId: application.user,
        key: "application.approved",
        link: "/barber",
        force: true,
      });

      await audit({
        actor: input.by,
        action: "application.approve",
        kind: "application",
        target: application.id,
        detail: target.id,
      });

      return { ok: true, application: approved };
    }

    case "reject": {
      const reason = clean(input.note, SIZES.reason) || "The application was not approved.";
      const row = await update(TABLES.applications, application.id, {
        state: "rejected",
        reason,
      });
      const rejected = toApplication(row);
      await record(rejected, "rejected", input.by, reason);

      await notify({
        userId: application.user,
        key: "application.rejected",
        params: { reason },
        force: true,
      });

      await audit({
        actor: input.by,
        action: "application.reject",
        kind: "application",
        target: application.id,
        detail: reason,
      });

      return { ok: true, application: rejected };
    }

    case "request": {
      const note = clean(input.note, SIZES.note) || "Please add more detail to your application.";
      const row = await update(TABLES.applications, application.id, {
        state: "info",
        note,
      });
      const requested = toApplication(row);
      await record(requested, "info", input.by, note);

      await notify({
        userId: application.user,
        key: "application.info",
        params: { note },
        force: true,
      });

      await audit({
        actor: input.by,
        action: "application.request",
        kind: "application",
        target: application.id,
        detail: note,
      });

      return { ok: true, application: requested };
    }

    case "suspend": {
      const reason = clean(input.note, SIZES.reason) || "Suspended by the platform.";

      if (application.target) {
        if (application.model === "b") {
          await updateBusiness(application.target, { state: "suspended", active: false });
        } else {
          await updateBarber(application.target, { state: "suspended", active: false });
        }
      }

      const row = await update(TABLES.applications, application.id, {
        state: "suspended",
        reason,
      });
      const suspended = toApplication(row);
      await record(suspended, "suspended", input.by, reason);

      await audit({
        actor: input.by,
        action: "application.suspend",
        kind: "application",
        target: application.id,
        detail: reason,
      });

      return { ok: true, application: suspended };
    }

    default:
      return { ok: false, status: 400, code: "bad_decision", message: "Unknown decision." };
  }
}

/**
 * Create the public record an approved application points at.
 *
 * Model A reuses the account's existing professional row when there is one,
 * so re-applying never duplicates a profile.
 */
async function publish(
  application: Application,
  payload: ApplicationPayload,
): Promise<{ id: string }> {
  if (application.model !== "b") {
    const existing = await barberForUser(application.user);
    if (existing) {
      await updateBarber(existing.id, {
        name: payload.name || existing.name,
        bio: payload.bio ?? existing.bio,
        city: payload.city ?? existing.city,
        district: payload.district ?? existing.district,
        address: payload.address ?? existing.address,
        phone: payload.phone ?? existing.phone,
        years: payload.years ?? existing.years,
        confirm: payload.confirm ?? existing.confirm,
        state: "active",
        active: true,
      });
      return { id: existing.id };
    }

    const barber = await createBarber({
      user: application.user,
      name: payload.name || application.name || "Barber",
      bio: payload.bio ?? "",
      city: payload.city ?? application.city,
      district: payload.district ?? application.district,
      address: payload.address ?? application.address,
      phone: payload.phone ?? application.phone,
      years: payload.years ?? 0,
      langs: payload.langs ?? "",
      skills: payload.skills ?? "",
      policy: payload.policy ?? "",
      confirm: payload.confirm ?? false,
      state: "active",
    });

    await seedSchedule(barber.id, "barber", payload);
    await seedServices(barber.id, "", payload);

    return { id: barber.id };
  }

  const business = await createBusiness({
    owner: application.user,
    name: payload.shop || payload.name || application.shop || "Barbershop",
    city: payload.city ?? application.city,
    phone: payload.phone ?? application.phone,
    confirm: payload.confirm ?? true,
  });

  await updateBusiness(business.id, {
    about: payload.bio ?? "",
    district: payload.district ?? application.district,
    address: payload.address ?? application.address,
    lat: payload.lat ?? 0,
    lng: payload.lng ?? 0,
    seats: payload.seats ?? 0,
    state: "active",
    active: true,
    slug: business.slug,
  });

  // A shop always starts with one branch so bookings have somewhere to land.
  const branch = await createBranch({
    business: business.id,
    name: "Main",
    city: payload.city ?? application.city,
    primary: true,
  });

  await seedSchedule(branch.id, "branch", payload);
  await seedServices("", business.id, payload);

  // The owner gets their own professional row so they can hold appointments.
  const ownerBarber = await createBarber({
    user: application.user,
    name: payload.name || application.name || "Barber",
    business: business.id,
    branch: branch.id,
    bio: payload.bio ?? "",
    city: payload.city ?? application.city,
    district: payload.district ?? application.district,
    address: payload.address ?? application.address,
    phone: payload.phone ?? application.phone,
    years: payload.years ?? 0,
    confirm: false,
    state: "active",
  });

  await seedSchedule(ownerBarber.id, "barber", payload);

  // The shared catalogue has to be assigned to the owner's barber row, or
  // servicesFor() sees an unqualified employee and bookings cannot be made.
  await seedServices(ownerBarber.id, business.id, payload, true);

  // Without an owner membership the account has no `owns` scope and cannot
  // reach the team, branch or export tools in the professional workspace.
  await addMember({
    business: business.id,
    user: application.user,
    role: "owner",
    barber: ownerBarber.id,
    branch: branch.id,
    state: "active",
  });

  return { id: business.id };
}

async function seedSchedule(
  owner: string,
  scope: "barber" | "branch",
  payload: ApplicationPayload,
): Promise<void> {
  const hours = payload.hours ?? [];
  if (hours.length === 0) return;

  const { setHours } = await import("./schedule");
  await setHours(owner, scope, hours);
}

async function seedServices(
  barberId: string,
  businessId: string,
  payload: ApplicationPayload,
  assignOnly = false,
): Promise<void> {
  if (!assignOnly && (payload.services?.length ?? 0) === 0) return;

  const { createService, assignService, listBusinessServices } = await import("./catalog");

  if (assignOnly) {
    if (!barberId || !businessId) return;
    const catalogue = await listBusinessServices(businessId);
    for (const service of catalogue) {
      await assignService({ business: businessId, barber: barberId, service: service.id });
    }
    return;
  }

  for (const [index, service] of (payload.services ?? []).entries()) {
    const created = await createService({
      name: service.name,
      price: service.price,
      time: service.time,
      note: service.note,
      barber: barberId || undefined,
      business: businessId || undefined,
      sort: index,
    });

    if (businessId && barberId) {
      await assignService({
        business: businessId,
        barber: barberId,
        service: created.id,
      });
    }
  }
}

/* -------------------------------------------------------------- helpers */

/** The one application an account has, or null when they never applied. */
export async function latestApplication(userId: string): Promise<Application | null> {
  return applicationFor(userId);
}

/** States that still let the applicant edit and resubmit. */
export function isEditable(state: AppState): boolean {
  return state === "draft" || state === "info" || state === "rejected";
}

export function isPending(state: AppState): boolean {
  return state === "submitted" || state === "review";
}
