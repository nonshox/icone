import "server-only";

import {
  AppwriteException,
  Account,
  Users,
  type Models,
} from "node-appwrite";
import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/appwrite/server";

export type TelegramUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  authDate: number;
};

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;

/**
 * Verify data sent by a Telegram Mini App (`WebApp.initData`). The key is
 * derived differently from the Login Widget: HMAC(botToken, "WebAppData").
 * https://core.telegram.org/widgets/login#validating-data-received-via-the-mini-app
 */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const providedHash = params.get("hash");
  if (!providedHash) return null;

  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  const provided = Buffer.from(providedHash, "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  const authDate = Number.parseInt(params.get("auth_date") ?? "", 10);
  if (!Number.isFinite(authDate)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (
    authDate > now + MAX_FUTURE_SKEW_SECONDS ||
    now - authDate > MAX_AUTH_AGE_SECONDS
  ) {
    return null;
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(params.get("user") ?? "") as Record<string, unknown>;
  } catch {
    return null;
  }

  const id = String(raw?.id ?? "");
  if (!/^\d{1,15}$/.test(id)) return null;

  const clean = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) || null : null;

  return {
    id,
    firstName: clean(raw.first_name, 64) ?? "Telegram",
    lastName: clean(raw.last_name, 64),
    username: clean(raw.username, 64),
    photoUrl: clean(raw.photo_url, 512),
    authDate,
  };
}

/**
 * Find or create the Appwrite user behind a Telegram account, then return a
 * real session. Telegram users live under the deterministic id `tg_<id>`.
 */
export async function signInWithTelegram(tg: TelegramUser): Promise<{
  session: Models.Session;
  user: Models.User<Models.Preferences>;
}> {
  const adminClient = createAdminClient();
  const users = new Users(adminClient);
  const account = new Account(adminClient);
  const userId = `tg_${tg.id}`;
  const displayName =
    [tg.firstName, tg.lastName].filter(Boolean).join(" ").trim().slice(0, 128) ||
    tg.username ||
    "Telegram member";

  let existing: Models.User<Models.Preferences> | null = null;

  try {
    existing = await users.get({ userId });
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 404) {
      throw error;
    }
  }

  let user: Models.User<Models.Preferences>;

  if (!existing) {
    user = await users.create({ userId, name: displayName });
  } else {
    user = existing;
    if (!user.name.trim()) {
      user = await users.updateName({ userId, name: displayName });
    }
  }

  try {
    await users.updatePrefs({
      userId,
      prefs: {
        ...user.prefs,
        telegramId: tg.id,
        telegramUsername: tg.username ?? "",
        telegramPhotoUrl: tg.photoUrl ?? "",
      },
    });
  } catch (error) {
    // Preferences are metadata; losing them must not block sign-in.
    console.error("[auth] failed to store Telegram preferences", error);
  }

  const token = await users.createToken({ userId, length: 64, expire: 120 });
  const session = await account.createSession({
    userId,
    secret: token.secret,
  });

  return { session, user };
}
