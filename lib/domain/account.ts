import "server-only";

import { Query } from "node-appwrite";
import { cache } from "react";

import { TABLES } from "@/lib/appwrite/db";

import {
  bool,
  clean,
  createOrGet,
  first,
  get,
  getMany,
  json,
  list,
  num,
  str,
  update,
  type Row,
} from "./crud";
import { DEFAULT_PREFS, type Locale, type NotificationPrefs, type Profile } from "./types";

const SIZES = { name: 64, phone: 32, avatar: 512 };

export function toProfile(row: Row): Profile {
  const locale = str(row.locale, "uz");
  return {
    id: row.$id,
    name: str(row.name, "Member"),
    phone: str(row.phone),
    role: str(row.role, "client") as Profile["role"],
    avatar: str(row.avatar),
    locale: (locale === "ru" || locale === "en" ? locale : "uz") as Locale,
    plan: str(row.plan, "free"),
    state: str(row.state, "active") === "suspended" ? "suspended" : "active",
    prefs: { ...DEFAULT_PREFS, ...json<Partial<NotificationPrefs>>(row.prefs, {}) },
  };
}

export const getProfile = cache(async (id: string): Promise<Profile | null> => {
  const row = await get(TABLES.users, id);
  return row ? toProfile(row) : null;
});

/** Resolve many profiles in one request, keyed by id. */
export async function getProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const rows = await getMany(TABLES.users, ids);
  return new Map(rows.map((row) => [row.$id, toProfile(row)]));
}

/**
 * Create the profile row on first sign-in. Safe to call repeatedly: two
 * parallel requests race on the primary key and the loser reads the winner.
 */
export async function ensureProfile(user: {
  $id: string;
  name: string;
}): Promise<Profile> {
  const name = clean(user.name, SIZES.name) || "Member";

  try {
    const row = await createOrGet(
      TABLES.users,
      user.$id,
      {
        name,
        phone: "",
        role: "client",
        avatar: "",
        locale: "uz",
        prefs: "",
        plan: "free",
        state: "active",
      },
    );
    return toProfile(row);
  } catch (error) {
    const existing = await getProfile(user.$id);
    if (existing) return existing;
    throw error;
  }
}

export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    phone?: string;
    avatar?: string;
  },
): Promise<Profile> {
  const data: Record<string, unknown> = {};
  if (typeof patch.name === "string") data.name = clean(patch.name, SIZES.name);
  if (typeof patch.phone === "string") data.phone = clean(patch.phone, SIZES.phone);
  if (typeof patch.avatar === "string") data.avatar = clean(patch.avatar, SIZES.avatar);

  const row = await update(TABLES.users, userId, data);
  return toProfile(row);
}

/** Promote an account when it becomes a professional. Customer pages stay open. */
export async function setRole(
  userId: string,
  role: "client" | "barber" | "admin",
): Promise<void> {
  await update(TABLES.users, userId, { role });
}

export async function setLocale(
  userId: string,
  locale: Locale,
): Promise<Profile> {
  const row = await update(TABLES.users, userId, { locale });
  return toProfile(row);
}

export async function setPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<Profile> {
  const normalized: NotificationPrefs = {
    booking: !!prefs.booking,
    reminder: !!prefs.reminder,
    waitlist: !!prefs.waitlist,
    business: !!prefs.business,
  };
  const row = await update(TABLES.users, userId, {
    prefs: JSON.stringify(normalized),
  });
  return toProfile(row);
}

export async function suspendProfile(userId: string, suspended: boolean): Promise<void> {
  await update(TABLES.users, userId, { state: suspended ? "suspended" : "active" });
}

/* ------------------------------------------------------------- membership */

export type MembershipSummary = {
  /** Businesses where this person is the owner. */
  owns: string[];
  /** Businesses where this person has an active membership. */
  belongs: string[];
  /** True when the person is approved to run a professional workspace. */
  professional: boolean;
  /** True when the person runs any workspace at all. */
  staff: boolean;
};

/**
 * What the signed-in person is allowed to open, derived from their own
 * barber row and their memberships. Used to pick the right workspace shell.
 */
export const membershipSummary = cache(
  async (userId: string): Promise<MembershipSummary> => {
    const [barberRows, membershipRows] = await Promise.all([
      list(TABLES.barbers, [Query.equal("user", userId), Query.limit(1)]),
      list(TABLES.memberships, [Query.equal("user", userId), Query.limit(50)]),
    ]);

    const active = membershipRows.filter(
      (row) => str(row.state) === "active" && bool(row.active, true),
    );

    const owns = active
      .filter((row) => str(row.role) === "owner")
      .map((row) => str(row.business));

    const belongs = active.map((row) => str(row.business));

    const professional =
      barberRows.length > 0 ||
      active.length > 0 ||
      owns.length > 0;

    return {
      owns: [...new Set(owns)],
      belongs: [...new Set(belongs)],
      professional,
      staff: professional,
    };
  },
);

/** The professional row linked to an account, if they have one. */
export async function barberForUser(userId: string): Promise<Row | null> {
  return first(TABLES.barbers, [Query.equal("user", userId)]);
}

/** A profile's numeric fields are only ever read through this. */
export function profileViews(row: Row): number {
  return num(row.views);
}
