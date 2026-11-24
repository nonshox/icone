import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

import { ensureProfile, getProfile } from "./data";
import type { Profile, Role } from "./types";

export function isStaff(role: Role): boolean {
  return role === "barber" || role === "admin";
}

/** Best-effort profile creation for auth routes — never breaks sign-in. */
export async function safeEnsureProfile(user: {
  $id: string;
  name: string;
}): Promise<void> {
  try {
    await ensureProfile(user);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`[domain] could not create profile (${code}) for ${user.$id}`);
  }
}

/**
 * The signed-in member plus their profile row. Creates the row on first use so
 * accounts that predate the table still work.
 *
 * If the database is unreachable (missing scopes, outage), fall back to a
 * client profile built from the auth user. Booking routes still fail loudly —
 * this only keeps account and sign-in usable.
 */
export async function currentMember(): Promise<{
  user: SessionUser;
  profile: Profile;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  let profile: Profile | null = null;

  try {
    profile =
      (await getProfile(user.id)) ??
      (await ensureProfile({ $id: user.id, name: user.name }));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`[domain] profile unavailable (${code}) for ${user.id}`);
  }

  return {
    user,
    profile:
      profile ?? {
        id: user.id,
        name: user.name || "Member",
        phone: "",
        role: "client",
        avatar: "",
      },
  };
}
