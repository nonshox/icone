import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import {
  signInWithTelegram,
  verifyWebAppInitData,
} from "@/lib/auth/telegram";
import { toSessionUser } from "@/lib/auth/user";
import { createWebLoginTicket } from "@/lib/auth/web-login";
import { ensureProfile } from "@/lib/domain/account";
import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  initData: z.string().min(1).max(16_384),
});

/**
 * POST /api/auth/telegram/mini
 * Exchange a signed Mini App payload for a normal Appwrite session cookie.
 * No domain registration is needed — Telegram signs the data with the bot token.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const limit = await rateLimit(
    `telegram:mini:${clientIp(request)}`,
    20,
    10 * 60_000,
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Telegram did not send valid data.", 400, "bad_init_data");
  }

  const env = serverEnv();
  const telegramUser = verifyWebAppInitData(
    parsed.data.initData,
    env.TELEGRAM_BOT_TOKEN,
  );

  if (!telegramUser) {
    return apiError(
      "Telegram could not verify this session. Reopen the bot and try again.",
      401,
      "bad_signature",
    );
  }

  try {
    const { session, user } = await signInWithTelegram(telegramUser);
    await ensureProfile({ $id: user.$id, name: user.name });

    const webLoginUrl = await createWebLoginTicket(user.$id).catch((error) => {
      console.error("[auth] could not create website login link", error);
      return null;
    });

    const response = NextResponse.json({
      ok: true as const,
      user: toSessionUser(user),
      webLoginUrl,
    });
    response.cookies.set(
      SESSION_COOKIE,
      session.secret,
      sessionCookieOptions(session.expire),
    );
    return response;
  } catch (error) {
    console.error("[auth] telegram mini sign-in failed", error);
    return apiError(
      "Could not sign you in. Try again from the bot.",
      502,
      "mini_sign_in_failed",
    );
  }
}
