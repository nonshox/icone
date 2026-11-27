import "server-only";

import { randomBytes } from "node:crypto";
import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { bool, clean, create, first, json, list, remove, str, update, type Row } from "./crud";
import { addDays, shopClock } from "./time";
import type { Invite, Membership, TeamRole } from "./types";

const SIZES = { name: 64, phone: 32, token: 64, perms: 1024 };

/** How long a team invitation stays usable. */
export const INVITE_DAYS = 14;

export function toMembership(row: Row): Membership {
  return {
    id: row.$id,
    business: str(row.business),
    user: str(row.user),
    barber: str(row.barber),
    branch: str(row.branch),
    role: (str(row.role, "barber") || "barber") as TeamRole,
    state: (str(row.state, "active") || "active") as Membership["state"],
    perms: json<Record<string, boolean>>(row.perms, {}),
    active: bool(row.active, true),
  };
}

export function toInvite(row: Row): Invite {
  return {
    id: row.$id,
    business: str(row.business),
    role: (str(row.role, "barber") || "barber") as TeamRole,
    to: str(row.to),
    phone: str(row.phone),
    name: str(row.name),
    token: str(row.token),
    by: str(row.by),
    branch: str(row.branch),
    state: (str(row.state, "pending") || "pending") as Invite["state"],
    expires: str(row.expires),
  };
}

/** An invitation that is past its expiry date, whatever it still says. */
export function inviteExpired(invite: Invite): boolean {
  if (invite.state !== "pending") return false;
  if (!invite.expires) return false;
  return invite.expires < shopClock().date;
}

export function effectiveInviteState(invite: Invite): Invite["state"] {
  return inviteExpired(invite) ? "expired" : invite.state;
}

/* ------------------------------------------------------------- membership */

export async function listMemberships(businessId: string): Promise<Membership[]> {
  const rows = await list(TABLES.memberships, [
    Query.equal("business", businessId),
    Query.limit(100),
  ]);
  return rows
    .map(toMembership)
    .filter((row) => row.state !== "removed")
    .sort((a, b) => a.role.localeCompare(b.role));
}

export async function membershipFor(
  businessId: string,
  userId: string,
): Promise<Membership | null> {
  const row = await first(TABLES.memberships, [
    Query.equal("business", businessId),
    Query.equal("user", userId),
  ]);
  if (!row) return null;
  const membership = toMembership(row);
  return membership.state === "removed" ? null : membership;
}

export async function membershipsForUser(userId: string): Promise<Membership[]> {
  const rows = await list(TABLES.memberships, [
    Query.equal("user", userId),
    Query.limit(50),
  ]);
  return rows.map(toMembership);
}

/** Attach an account to a business, or update its role if already attached. */
export async function addMember(input: {
  business: string;
  user: string;
  role: TeamRole;
  barber?: string;
  branch?: string;
  state?: Membership["state"];
}): Promise<Membership> {
  const existing = await first(TABLES.memberships, [
    Query.equal("business", input.business),
    Query.equal("user", input.user),
  ]);

  if (existing) {
    // A removed member rejoining gets a clean row rather than their old role.
    const row = await update(TABLES.memberships, existing.$id, {
      role: input.role,
      state: input.state ?? "active",
      active: true,
      barber: input.barber ?? str(existing.barber),
      branch: input.branch ?? str(existing.branch),
      perms: "{}",
    });
    return toMembership(row);
  }

  const row = await create(TABLES.memberships, {
    business: input.business,
    user: input.user,
    barber: input.barber ?? "",
    branch: input.branch ?? "",
    role: input.role,
    state: input.state ?? "active",
    perms: "{}",
    active: true,
  });
  return toMembership(row);
}

export async function updateMember(
  id: string,
  patch: {
    role?: TeamRole;
    state?: Membership["state"];
    active?: boolean;
    barber?: string;
    branch?: string;
    perms?: Record<string, boolean>;
  },
): Promise<Membership> {
  const data: Record<string, unknown> = {};
  if (patch.role) data.role = patch.role;
  if (patch.state) data.state = patch.state;
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.barber === "string") data.barber = patch.barber;
  if (typeof patch.branch === "string") data.branch = patch.branch;
  if (patch.perms) data.perms = JSON.stringify(patch.perms).slice(0, SIZES.perms);

  const row = await update(TABLES.memberships, id, data);
  return toMembership(row);
}

/**
 * Detach an account from a business without touching history.
 *
 * Their past appointments keep pointing at the professional row and the
 * customer records stay with the business — only the login link goes away.
 */
export async function removeMember(id: string): Promise<void> {
  await update(TABLES.memberships, id, {
    state: "removed",
    active: false,
  });
}

/** How many active people work in this business. */
export async function memberCount(businessId: string): Promise<number> {
  const rows = await list(TABLES.memberships, [
    Query.equal("business", businessId),
    Query.equal("state", "active"),
    Query.limit(100),
  ]);
  return rows.length;
}

/* --------------------------------------------------------------- invites */

function token(): string {
  return randomBytes(24).toString("hex");
}

export async function createInvite(input: {
  business: string;
  role: TeamRole;
  to?: string;
  phone?: string;
  name?: string;
  by: string;
  branch?: string;
}): Promise<Invite> {
  const row = await create(TABLES.invites, {
    business: input.business,
    role: input.role,
    to: input.to ?? "",
    phone: clean(input.phone, SIZES.phone),
    name: clean(input.name, SIZES.name),
    token: token(),
    by: input.by,
    branch: input.branch ?? "",
    state: "pending",
    expires: addDays(shopClock().date, INVITE_DAYS),
  });
  return toInvite(row);
}

export async function listInvites(businessId: string): Promise<Invite[]> {
  const rows = await list(TABLES.invites, [
    Query.equal("business", businessId),
    Query.limit(100),
  ]);
  return rows.map(toInvite).sort((a, b) => b.expires.localeCompare(a.expires));
}

/** Invitations addressed to one account, plus ones found by phone number. */
export async function invitationsFor(user: {
  id: string;
  phone: string;
}): Promise<Invite[]> {
  // Phone is self-asserted, so only account-addressed invitations are
  // surfaced. A phone-only invite is claimed through its unguessable token.
  const queries: string[][] = [
    [Query.equal("state", "pending"), Query.equal("to", user.id), Query.limit(50)],
  ];
  const found = await Promise.all(queries.map((q) => list(TABLES.invites, q)));
  const byId = new Map<string, Invite>();
  for (const invite of found.flat().map(toInvite)) {
    // A named invitation is only claimable by that exact account; phone
    // matching is the fallback for invitations sent before an account exists.
    if (invite.to && invite.to !== user.id) continue;
    byId.set(invite.id, invite);
  }
  return [...byId.values()].filter((invite) => !inviteExpired(invite));
}

export async function inviteByToken(raw: string): Promise<Invite | null> {
  if (!raw || raw.length < 8) return null;
  const row = await first(TABLES.invites, [Query.equal("token", raw)]);
  return row ? toInvite(row) : null;
}

export async function setInviteState(
  id: string,
  state: Invite["state"],
): Promise<Invite> {
  const row = await update(TABLES.invites, id, { state });
  return toInvite(row);
}

export async function revokeInvites(businessId: string): Promise<void> {
  const rows = await list(TABLES.invites, [
    Query.equal("business", businessId),
    Query.equal("state", "pending"),
    Query.limit(100),
  ]);
  await Promise.all(rows.map((row) => remove(TABLES.invites, row.$id)));
}

/* --------------------------------------------------------------- helpers */

/**
 * URL-safe handle for share links. Appwrite document ids are not pretty, so
 * public links fall back to the id when the slug would collide.
 */
export function slugify(value: string): string {
  return clean(value, 64)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Total people assigned to one professional's calendar. */
export function workload(rows: Array<{ start: number; end: number }>): number {
  return rows.reduce((total, row) => total + Math.max(0, row.end - row.start), 0);
}

export function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}

export function roleRank(role: TeamRole): number {
  return ["owner", "manager", "reception", "barber"].indexOf(role);
}
