import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Account, Users, type Models } from "node-appwrite";

import { createAdminClient } from "@/lib/appwrite/server";
import { serverEnv } from "@/lib/env";
import { sendMessage } from "@/lib/telegram/webhook";

const OTP_TTL_MS = 5 * 60_000;
const MAX_TRIES = 5;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

export function phoneUserId(phone: string): string {
  return `ph_${phone}`;
}

type OtpPrefs = {
  phone?: string;
  otpCode?: string;
  otpExp?: number;
  otpNonce?: string;
  otpTries?: number;
  telegramChat?: number;
};

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().TELEGRAM_WEBHOOK_SECRET)
    .update(payload)
    .digest("base64url");
}

/** A signed cookie only carries the request id, never the code itself. */
export function makeOtpCookie(phone: string, nonce: string): string {
  const payload = Buffer.from(
    JSON.stringify({ phone, nonce, exp: Date.now() + OTP_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readOtpCookie(
  token: string | undefined,
): { phone: string; nonce: string; exp: number } | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(sign(payload), "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { phone?: string; nonce?: string; exp?: number };
    if (!data.phone || !data.nonce || !data.exp || data.exp <= Date.now()) {
      return null;
    }
    return { phone: data.phone, nonce: data.nonce, exp: data.exp };
  } catch {
    return null;
  }
}

async function userFor(phone: string): Promise<Models.User<Models.Preferences>> {
  const users = new Users(createAdminClient());
  const userId = phoneUserId(phone);
  try {
    return await users.get({ userId });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 404) {
      return users.create({ userId, name: "Member" });
    }
    throw error;
  }
}

function prefsOf(user: Models.User<Models.Preferences>): OtpPrefs {
  return (user.prefs ?? {}) as OtpPrefs;
}

/** Create a 4-digit code and remember it server-side in the user's prefs. */
export async function startPhoneLogin(
  phone: string,
  chatId?: number,
): Promise<{ nonce: string; delivered: boolean }> {
  const users = new Users(createAdminClient());
  const user = await userFor(phone);
  const nonce = randomBytes(8).toString("hex");
  const code = String(randomInt(0, 10_000)).padStart(4, "0");
  const prefs = prefsOf(user);

  await users.updatePrefs({
    userId: user.$id,
    prefs: {
      ...prefs,
      phone,
      otpCode: code,
      otpExp: Date.now() + OTP_TTL_MS,
      otpNonce: nonce,
      otpTries: 0,
      ...(chatId ? { telegramChat: chatId } : {}),
    },
  });

  const delivered = chatId ? await sendCode(phone, nonce, chatId) : false;
  return { nonce, delivered };
}

/** Send the pending code to a Telegram chat that was linked by /start. */
export async function sendCode(
  phone: string,
  nonce: string,
  chatId: number,
): Promise<boolean> {
  const users = new Users(createAdminClient());
  const userId = phoneUserId(phone);
  let user: Models.User<Models.Preferences>;
  try {
    user = await users.get({ userId });
  } catch {
    return false;
  }

  const prefs = prefsOf(user);
  if (prefs.otpNonce !== nonce || !prefs.otpCode) return false;
  if (!prefs.otpExp || prefs.otpExp <= Date.now()) return false;

  await sendMessage(
    serverEnv().TELEGRAM_BOT_TOKEN,
    chatId,
    `Your icone code is ${prefs.otpCode}. It expires in 5 minutes.`,
  );
  await users.updatePrefs({
    userId,
    prefs: { ...prefs, telegramChat: chatId },
  });
  return true;
}

/** Redeem a code from the same browser/app that started the request. */
export async function verifyPhoneLogin(
  phone: string,
  nonce: string,
  code: string,
): Promise<{
  session: Models.Session | null;
  triesLeft: number;
}> {
  const users = new Users(createAdminClient());
  const userId = phoneUserId(phone);
  let user: Models.User<Models.Preferences>;
  try {
    user = await users.get({ userId });
  } catch {
    return { session: null, triesLeft: 0 };
  }

  const prefs = prefsOf(user);
  const tries = Number(prefs.otpTries ?? 0);
  if (
    prefs.otpNonce !== nonce ||
    !prefs.otpCode ||
    !prefs.otpExp ||
    prefs.otpExp <= Date.now() ||
    tries >= MAX_TRIES
  ) {
    return { session: null, triesLeft: Math.max(0, MAX_TRIES - tries) };
  }

  const provided = Buffer.from(code, "utf8");
  const expected = Buffer.from(prefs.otpCode, "utf8");
  const valid =
    provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!valid) {
    await users.updatePrefs({
      userId,
      prefs: { ...prefs, otpTries: tries + 1 },
    });
    return { session: null, triesLeft: MAX_TRIES - tries - 1 };
  }

  await users.updatePrefs({
    userId,
    prefs: {
      ...prefs,
      otpCode: "",
      otpExp: 0,
      otpNonce: "",
      otpTries: 0,
    },
  });

  const token = await users.createToken({ userId, length: 64, expire: 120 });
  const session = await new Account(createAdminClient()).createSession({
    userId,
    secret: token.secret,
  });
  return { session, triesLeft: MAX_TRIES };
}
