import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Account, Users, type Models } from "node-appwrite";

import { createAdminClient } from "@/lib/appwrite/server";
import { serverEnv } from "@/lib/env";

const TICKET_TTL_MS = 5 * 60_000;

type Payload = { uid: string; exp: number; n: string };

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().TELEGRAM_WEBHOOK_SECRET)
    .update(payload)
    .digest("base64url");
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Issue a single-use, signed link that logs the same member into the website.
 * The session secret is never placed in the URL — the link only carries a
 * short-lived nonce whose hash is stored in the user's Appwrite preferences.
 */
export async function createWebLoginTicket(userId: string): Promise<string> {
  const env = serverEnv();
  const users = new Users(createAdminClient());
  const exp = Date.now() + TICKET_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp,
      n: randomBytes(12).toString("hex"),
    } satisfies Payload),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;

  const user = await users.get({ userId });
  await users.updatePrefs({
    userId,
    prefs: {
      ...user.prefs,
      webTicket: hash(token),
      webTicketExp: String(exp),
    },
  });

  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/ticket?ticket=${encodeURIComponent(token)}`;
}

/** Redeem a ticket once. Returns a fresh Appwrite session on success. */
export async function redeemWebLoginTicket(token: string): Promise<{
  session: Models.Session;
  user: Models.User<Models.Preferences>;
} | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  if (!same(signature, sign(payload))) return null;

  let data: Payload;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }

  const now = Date.now();
  if (
    !data.uid ||
    !Number.isFinite(data.exp) ||
    data.exp <= now ||
    data.exp > now + TICKET_TTL_MS
  ) {
    return null;
  }

  const admin = createAdminClient();
  const users = new Users(admin);
  const account = new Account(admin);

  let user: Models.User<Models.Preferences>;
  try {
    user = await users.get({ userId: data.uid });
  } catch {
    return null;
  }

  const prefs = (user.prefs ?? {}) as Record<string, unknown>;
  const currentHash = String(prefs.webTicket ?? "");
  const currentExp = Number(prefs.webTicketExp ?? 0);

  if (!currentHash || !same(currentHash, hash(token)) || currentExp <= now) {
    return null;
  }

  // Burn the ticket before issuing the session so it cannot be replayed.
  await users.updatePrefs({
    userId: data.uid,
    prefs: { ...user.prefs, webTicket: "", webTicketExp: "" },
  });

  const issued = await users.createToken({
    userId: data.uid,
    length: 64,
    expire: 120,
  });
  const session = await account.createSession({
    userId: data.uid,
    secret: issued.secret,
  });

  return { session, user };
}
