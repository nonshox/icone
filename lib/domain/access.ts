import "server-only";

import { Query } from "node-appwrite";
import { cache } from "react";

import { TABLES } from "@/lib/appwrite/db";
import { getCurrentUser } from "@/lib/auth/session";

import { bool, list, str, type Row } from "./crud";
import { getProfile, type MembershipSummary } from "./account";
import { getBusiness, listBranches } from "./business";
import { toBarber, type BarberRow } from "./professional";
import { roleRank, toMembership } from "./team";
import type { Membership, Profile, TeamRole } from "./types";

/**
 * Server-side authorization.
 *
 * Every sensitive route handler calls `requireCap` before it touches data.
 * The rules live here, in one place, so a permission change cannot leak into
 * only half the handlers.
 *
 * Three layers, in order:
 *   1. platform admin — allowed everywhere in the admin application;
 *   2. scope match — a professional has full control of their own row, and an
 *      independent barber has full control of their own practice;
 *   3. business membership — the role's grants, then any per-membership
 *      override stored in `memberships.perms`.
 */

/* ------------------------------------------------------------- capabilities */

export const CAPABILITIES = [
  "calendar.read",
  "calendar.read.all",
  "calendar.write",
  "appointment.create",
  "appointment.manage",
  "appointment.manage.all",
  "service.read",
  "service.write",
  "customer.read",
  "customer.read.all",
  "customer.write",
  "team.read",
  "team.manage",
  "branch.read",
  "branch.manage",
  "analytics.read",
  "analytics.read.all",
  "settings.business",
  "settings.profile",
  "portfolio.write",
  "schedule.write",
  "export",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** What controlling your own professional row automatically grants. */
const OWN_CAPABILITIES: readonly Capability[] = [
  "calendar.read",
  "calendar.write",
  "appointment.create",
  "appointment.manage",
  "service.read",
  "service.write",
  "customer.read",
  "customer.write",
  "settings.profile",
  "portfolio.write",
  "schedule.write",
  "analytics.read",
];

/**
 * What each role gets out of the box. Per-membership `perms` entries override
 * these in either direction, so an owner can hand a receptionist analytics or
 * take `appointment.manage` away from a barber without changing their role.
 */
const ROLE_GRANTS: Record<TeamRole, readonly Capability[]> = {
  owner: CAPABILITIES,

  manager: [
    "calendar.read",
    "calendar.read.all",
    "calendar.write",
    "appointment.create",
    "appointment.manage",
    "appointment.manage.all",
    "service.read",
    "service.write",
    "customer.read",
    "customer.read.all",
    "customer.write",
    "team.read",
    "branch.read",
    "analytics.read",
    "analytics.read.all",
    "settings.profile",
    "portfolio.write",
    "schedule.write",
    "export",
  ],

  reception: [
    "calendar.read",
    "calendar.read.all",
    "calendar.write",
    "appointment.create",
    "appointment.manage",
    "appointment.manage.all",
    "service.read",
    "customer.read",
    "customer.read.all",
    "customer.write",
    "branch.read",
    "settings.profile",
  ],

  barber: [
    "calendar.read",
    "calendar.write",
    "appointment.create",
    "appointment.manage",
    "service.read",
    "customer.read",
    "customer.write",
    "settings.profile",
    "portfolio.write",
    "schedule.write",
  ],
};

/* ------------------------------------------------------------------- actor */

/** A business root with the display names the workspace header needs. */
export type ActiveBusiness = {
  id: string;
  name: string;
  /** The location shown beside the business name, when one is selected. */
  branch?: { id: string; name: string };
};

/** One selectable business and its locations, used by the workspace switcher. */
export type BusinessOption = {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
};

/**
 * `MembershipSummary` lives in `account.ts`; the workspace layer adds the
 * resolved business root without changing that shared shape.
 */
export type ActorSummary = MembershipSummary & {
  /** Business selected by the stable rule below, or null for a chair only. */
  active: ActiveBusiness | null;
};

export type Actor = {
  userId: string;
  profile: Profile;
  /** Their own professional row — independent barber or shop employee. */
  barber: BarberRow | null;
  memberships: Membership[];
  /** Businesses this account created. */
  owns: string[];
  summary: ActorSummary;
};

function businessIds(memberships: Membership[]): string[] {
  return [...new Set(memberships.map((row) => row.business).filter(Boolean))];
}

/**
 * The one stable business-root rule. Appwrite list order is not guaranteed, so
 * every tier is sorted explicitly and the same answer is returned on every
 * render and in every route handler.
 *
 *   1. an owned business (an active owner membership);
 *   2. an owner or manager membership;
 *   3. the first remaining membership.
 *
 * An independent barber has none of these and gets an empty id.
 */
export function activeBusinessId(actor: Actor): string {
  const byRank = (a: Membership, b: Membership) =>
    roleRank(a.role) - roleRank(b.role) || a.business.localeCompare(b.business);

  const owned = [...actor.owns].sort((a, b) => a.localeCompare(b));
  if (owned.length > 0) return owned[0];

  const leads = actor.memberships
    .filter((row) => row.role === "owner" || row.role === "manager")
    .sort(byRank);
  if (leads.length > 0) return leads[0].business;

  return actor.memberships.slice().sort(byRank)[0]?.business ?? "";
}

/** Resolve the root to display names and the member's default location. */
export async function activeBusiness(actor: Actor): Promise<ActiveBusiness | null> {
  const id = activeBusinessId(actor);
  if (!id) return null;

  const business = await getBusiness(id);
  // A deleted business is not a root; never invent a name for a stale id.
  if (!business) return null;

  const branches = await listBranches(id);
  const mine = actor.memberships
    .filter((row) => row.business === id)
    .sort((a, b) => roleRank(a.role) - roleRank(b.role));
  const ownBranch = actor.barber?.business === id ? actor.barber.branch : "";

  const branchId =
    mine.map((row) => row.branch).find(Boolean) ??
    (ownBranch ||
      branches.find((row) => row.primary)?.id ||
      branches[0]?.id ||
      "");
  const branch = branches.find((row) => row.id === branchId);

  return {
    id: business.id,
    name: business.name || business.slug || business.id,
    ...(branch
      ? { branch: { id: branch.id, name: branch.name || branch.id } }
      : {}),
  };
}

/** Owners and managers may switch the workspace they are looking at. */
export function canSwitchBusiness(actor: Actor): boolean {
  return actor.memberships.some(
    (row) => row.role === "owner" || row.role === "manager",
  );
}

/** Every business the actor belongs to, with its branches, for the switcher. */
export async function businessOptions(actor: Actor): Promise<BusinessOption[]> {
  const ids = [
    ...new Set([
      ...actor.owns,
      ...actor.memberships.map((row) => row.business),
    ]),
  ].filter(Boolean).sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) return [];

  const businesses = await Promise.all(ids.map((id) => getBusiness(id)));
  const options: BusinessOption[] = [];
  for (const business of businesses) {
    if (!business) continue;
    const branches = await listBranches(business.id);
    options.push({
      id: business.id,
      name: business.name || business.slug || business.id,
      branches: branches.map((row) => ({
        id: row.id,
        name: row.name || row.id,
      })),
    });
  }

  const first = activeBusinessId(actor);
  return options.sort((a, b) => {
    if (a.id === first) return -1;
    if (b.id === first) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Everything we need to authorize one request, resolved once per render. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await getProfile(user.id);
  if (!profile) return null;
  if (profile.state === "suspended") return null;

  const [barberRows, membershipRows] = await Promise.all([
    list(TABLES.barbers, [Query.equal("user", user.id), Query.limit(100)]),
    list(TABLES.memberships, [Query.equal("user", user.id), Query.limit(50)]),
  ]);

  const memberships = membershipRows
    .map(toMembership)
    .filter((row) => row.state === "active" && row.active);

  const barbers = barberRows.map(toBarber);
  const namedBarbers = new Set(
    memberships.map((row) => row.barber).filter(Boolean),
  );

  // An account can have more than one barber row (legacy duplicates, or a
  // member reassigned to a different chair). A membership that names a chair
  // is the explicit statement of identity; the first row returned by Appwrite
  // is not authoritative. Fall back to the first row only when no active
  // membership names one of ours.
  const named = memberships.find(
    (row) => row.barber && barbers.some((barber) => barber.id === row.barber),
  );
  const barber = named
    ? (barbers.find((row) => row.id === named.barber) ?? barbers[0] ?? null)
    : (barbers[0] ?? null);

  if (barbers.length > 1 && (!named || namedBarbers.size > 1)) {
    // Counts only: no user ids, tokens or other account details in logs.
    console.error("[access] ambiguous barber identity", {
      barberRows: barbers.length,
      namedMemberships: namedBarbers.size,
    });
  }

  const owns = businessIds(memberships.filter((row) => row.role === "owner"));
  const belongs = businessIds(memberships);

  const actor: Actor = {
    userId: user.id,
    profile,
    barber,
    memberships,
    owns,
    summary: {
      owns,
      belongs,
      professional: barberRows.length > 0 || memberships.length > 0,
      staff: barberRows.length > 0 || memberships.length > 0,
      active: null,
    },
  };

  // The business root is part of the actor contract, so pages and route
  // handlers can read `summary.active` without repeating the resolution rule.
  const active = await activeBusiness(actor);
  return { ...actor, summary: { ...actor.summary, active } };
});

/* ------------------------------------------------------------ capability */

export type Scope = {
  /** Business the operation happens inside. Empty for an independent barber. */
  business?: string;
  /** Professional the operation happens on. */
  barber?: string;
};

export function membershipFor(
  actor: Actor,
  business: string | undefined,
): Membership | null {
  if (!business) return null;
  return actor.memberships.find((row) => row.business === business) ?? null;
}

export function can(
  actor: Actor | null,
  capability: Capability,
  scope: Scope = {},
): boolean {
  if (!actor) return false;
  if (actor.profile.role === "admin") return true;

  // A professional controls their own row (Model A), but only for capabilities
  // that belong to a single chair. An explicit per-membership `false` always
  // wins, even on the actor's own barber id.
  if (scope.barber && actor.barber?.id === scope.barber) {
    if (!OWN_CAPABILITIES.includes(capability)) return false;
    const ownMemberships = actor.memberships.filter(
      (row) => row.barber === scope.barber,
    );
    if (ownMemberships.some((row) => row.perms[capability] === false)) return false;
    return true;
  }

  const membership = membershipFor(actor, scope.business);
  if (!membership) {
    // No scope means "any of my businesses" — used by list endpoints.
    if (!scope.business && !scope.barber) {
      return actor.memberships.some((row) =>
        ROLE_GRANTS[row.role].includes(capability),
      );
    }
    return false;
  }

  const override = membership.perms[capability];
  if (typeof override === "boolean") return override;

  return ROLE_GRANTS[membership.role].includes(capability);
}

export type AuthFailure = {
  status: number;
  code: string;
  message: string;
};

/** Raise a typed 401/403 instead of leaking whether the row exists. */
export function deny(
  status: 401 | 403,
  code: string,
  message: string,
): AuthFailure {
  return { status, code, message };
}

export function forbidden(message = "You do not have access to this."): AuthFailure {
  return deny(403, "forbidden", message);
}

/** True when the actor may act on this business at all. */
export function inBusiness(actor: Actor | null, business: string): boolean {
  if (!actor) return false;
  if (actor.profile.role === "admin") return true;
  if (actor.owns.includes(business)) return true;
  return actor.memberships.some((row) => row.business === business);
}

/** True when the actor may act on this professional at all. */
export function onBarber(actor: Actor | null, barberId: string): boolean {
  if (!actor) return false;
  if (actor.profile.role === "admin") return true;
  if (actor.barber?.id === barberId) return true;
  return actor.memberships.some((row) => row.barber === barberId);
}

/** Businesses whose books this actor may read. */
export function readableBusinesses(actor: Actor): string[] {
  return businessIds(
    actor.memberships.filter((row) =>
      ROLE_GRANTS[row.role].includes("analytics.read"),
    ),
  );
}

/** The professional rows this actor may open in the calendar. */
export async function readableBarbers(actor: Actor): Promise<string[]> {
  const rows = new Set<string>();
  if (actor.barber) rows.add(actor.barber.id);
  for (const membership of actor.memberships) {
    if (membership.barber) rows.add(membership.barber);
  }
  // Owners, managers and receptionists may see every calendar in a business,
  // including employees who have no explicit membership.barber value.
  for (const business of businessIds(actor.memberships)) {
    if (!can(actor, "calendar.read.all", { business })) continue;
    const staff = await list(TABLES.barbers, [
      Query.equal("business", business),
      Query.limit(100),
    ]);
    for (const row of staff) rows.add(str(row.$id));
  }
  return [...rows];
}

/** True when the actor sits in front of a shared workspace at all. */
export function hasTeam(actor: Actor): boolean {
  return actor.memberships.length > 0;
}

export function isOwner(actor: Actor, business: string): boolean {
  return (
    actor.profile.role === "admin" ||
    actor.memberships.some(
      (row) => row.business === business && row.role === "owner",
    )
  );
}

export function isAdmin(actor: Actor | null): boolean {
  return actor?.profile.role === "admin";
}

/** Row helper reused by the handlers that only need a yes/no. */
export function rowActive(row: Row): boolean {
  return bool(row.active, true);
}

export function rowScope(row: Row): string {
  return str(row.business);
}
