import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Account, Users, type Models } from "node-appwrite";

import { createAdminClient } from "@/lib/appwrite/server";
import { serverEnv } from "@/lib/env";
import { publicConfig } from "@/lib/public-config";
import { sendMessage } from "@/lib/telegram/webhook";

const OTP_TTL_MS = 5 * 60_000;
const MAX_TRIES = 5;

type Prefs = Record<string, unknown>;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** A short-lived, throwaway account that only holds an OTP request. */
export function pendingUserId(nonce: string): string {
  return `otp_${nonce}`;
}

function telegramUserId(chatId: number): string {
  return `tg_${chatId}`;
}

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().TELEGRAM_WEBHOOK_SECRET)
    .update(payload)
    .digest("base64url");
}

/** The cookie holds only a signed request id — never the code. */
export function makeOtpCookie(nonce: string, phone = ""): string {
  const payload = Buffer.from(
    JSON.stringify({ nonce, phone, exp: Date.now() + OTP_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readOtpCookie(
  token: string | undefined,
): { nonce: string; phone: string; exp: number } | null {
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
    ) as { nonce?: string; phone?: string; exp?: number };
    if (!data.nonce || !data.exp || data.exp <= Date.now()) return null;
    return { nonce: data.nonce, phone: data.phone ?? "", exp: data.exp };
  } catch {
    return null;
  }
}

async function ensureUser(
  userId: string,
  name = "Member",
): Promise<Models.User<Models.Preferences>> {
  const users = new Users(createAdminClient());
  try {
    return await users.get({ userId });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 404) {
      return users.create({ userId, name });
    }
    throw error;
  }
}

/**
 * Start a login. With no phone, the bot asks for it with a one-tap contact
 * button; with a phone typed manually, the code is created immediately.
 */
export async function startPhoneLogin(phone?: string): Promise<{
  nonce: string;
  botLink: string;
}> {
  const users = new Users(createAdminClient());
  const nonce = randomBytes(8).toString("hex");
  const userId = pendingUserId(nonce);
  await ensureUser(userId);

  const prefs: Prefs = { phone: phone ?? "", otpTries: 0 };
  if (phone) {
    prefs.otpCode = String(randomInt(0, 10_000)).padStart(4, "0");
    prefs.otpExp = Date.now() + OTP_TTL_MS;
  }
  await users.updatePrefs({ userId, prefs });

  const bot = `https://t.me/${publicConfig.telegramBotUsername}`;
  const payload = phone ? `otp_${nonce}_${phone}` : `phone_${nonce}`;
  return { nonce, botLink: `${bot}?start=${payload}` };
}

/** Bot received a shared contact for a pending web request. */
export async function linkTelegramPhone(
  nonce: string,
  chatId: number,
  phone: string,
): Promise<boolean> {
  const users = new Users(createAdminClient());
  const userId = pendingUserId(nonce);
  let user: Models.User<Models.Preferences>;
  try {
    user = await users.get({ userId });
  } catch {
    return false;
  }

  const code = String(randomInt(0, 10_000)).padStart(4, "0");
  await users.updatePrefs({
    userId,
    prefs: {
      ...(user.prefs ?? {}),
      phone,
      otpCode: code,
      otpExp: Date.now() + OTP_TTL_MS,
      otpTries: 0,
      telegramChat: chatId,
    },
  });
  return sendCode(nonce, chatId);
}

/** Send the pending code to the Telegram chat that owns the request. */
export async function sendCode(nonce: string, chatId: number): Promise<boolean> {
  const users = new Users(createAdminClient());
  const userId = pendingUserId(nonce);
  let user: Models.User<Models.Preferences>;
  try {
    user = await users.get({ userId });
  } catch {
    return false;
  }

  const prefs = (user.prefs ?? {}) as Prefs;
  const code = String(prefs.otpCode ?? "");
  if (!code || !prefs.otpExp || Number(prefs.otpExp) <= Date.now()) return false;

  await sendMessage(
    serverEnv().TELEGRAM_BOT_TOKEN,
    chatId,
    `Your icone code is ${code}. It expires in 5 minutes.`,
  );
  await users.updatePrefs({
    userId,
    prefs: { ...prefs, telegramChat: chatId },
  });
  return true;
}

/** Remember which chat owes a phone number for a one-tap share. */
export async function markPhoneRequest(chatId: number, nonce: string): Promise<void> {
  const users = new Users(createAdminClient());
  const userId = `chat_${chatId}`;
  const user = await ensureUser(userId, "Telegram member");
  await users.updatePrefs({
    userId: user.$id,
    prefs: { ...(user.prefs ?? {}), pendingNonce: nonce },
  });
}

/** Read the pending request created by `/start phone_<nonce>`. */
export async function pendingNonceForChat(chatId: number): Promise<string | null> {
  try {
    const user = await new Users(createAdminClient()).get({ userId: `chat_${chatId}` });
    const nonce = String((user.prefs as Prefs).pendingNonce ?? "");
    return nonce || null;
  } catch {
    return null;
  }
}

/** Redeem the code in the same browser/app that requested it. */
export async function verifyPhoneLogin(
  nonce: string,
  code: string,
): Promise<{
  session: Models.Session | null;
  userId: string;
  phone: string;
  triesLeft: number;
}> {
  const users = new Users(createAdminClient());
  const pendingId = pendingUserId(nonce);
  let pending: Models.User<Models.Preferences>;
  try {
    pending = await users.get({ userId: pendingId });
  } catch {
    return { session: null, userId: "", phone: "", triesLeft: 0 };
  }

  const prefs = (pending.prefs ?? {}) as Prefs;
  const tries = Number(prefs.otpTries ?? 0);
  if (
    !prefs.otpCode ||
    !prefs.otpExp ||
    Number(prefs.otpExp) <= Date.now() ||
    tries >= MAX_TRIES
  ) {
    return { session: null, userId: "", phone: "", triesLeft: Math.max(0, MAX_TRIES - tries) };
  }

  const provided = Buffer.from(code, "utf8");
  const expected = Buffer.from(String(prefs.otpCode), "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    await users.updatePrefs({
      userId: pendingId,
      prefs: { ...prefs, otpTries: tries + 1 },
    });
    return { session: null, userId: "", phone: "", triesLeft: MAX_TRIES - tries - 1 };
  }

  const phone = String(prefs.phone ?? "");
  const chatId = Number(prefs.telegramChat ?? 0);
  const canonicalId =
    Number.isSafeInteger(chatId) && chatId > 0 ? telegramUserId(chatId) : pendingId;

  if (canonicalId !== pendingId) {
    const canonical = await ensureUser(canonicalId);
    await users.updatePrefs({
      userId: canonicalId,
      prefs: {
        ...(canonical.prefs ?? {}),
        phone,
        telegramId: String(chatId),
        otpCode: "",
        otpExp: 0,
        otpTries: 0,
      },
    });
  }
  await users.delete({ userId: pendingId }).catch(() => {});
  if (chatId > 0) await users.delete({ userId: `chat_${chatId}` }).catch(() => {});

  const token = await users.createToken({ userId: canonicalId, length: 64, expire: 120 });
  const session = await new Account(createAdminClient()).createSession({
    userId: canonicalId,
    secret: token.secret,
  });
  return { session, userId: canonicalId, phone, triesLeft: MAX_TRIES };
}
