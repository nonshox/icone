import "server-only";

import type { Models } from "node-appwrite";

import type { SessionUser } from "./types";

type UserPreferences = {
  telegramId?: unknown;
  telegramUsername?: unknown;
  telegramPhotoUrl?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Convert an Appwrite user into the small DTO the UI is allowed to see. */
export function toSessionUser(
  user: Models.User<Models.Preferences>,
): SessionUser {
  const prefs = (user.prefs ?? {}) as UserPreferences;
  const telegramId = nonEmptyString(prefs.telegramId);
  const telegramUsername = nonEmptyString(prefs.telegramUsername);
  const avatarUrl = nonEmptyString(prefs.telegramPhotoUrl);
  const email = user.email || null;
  const fallbackName = telegramUsername ?? (email ? email.split("@")[0] : null);

  return {
    id: user.$id,
    name: user.name || fallbackName || "Member",
    email,
    createdAt: user.registration,
    provider: telegramId ? "telegram" : email ? "email" : "unknown",
    telegramUsername,
    avatarUrl,
  };
}
