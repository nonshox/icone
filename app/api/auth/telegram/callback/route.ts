import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { signInWithTelegram, verifyTelegramPayload } from "@/lib/auth/telegram";
import { safeEnsureProfile } from "@/lib/domain/member";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/auth/telegram/callback
 * Telegram's Login Widget redirects here with signed user data. Verify it,
 * upsert the Appwrite user, exchange a server-side token for a session and
 * land the member on their account page.
 */
export async function GET(request: NextRequest) {
  const env = serverEnv();
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${code}`, baseUrl), 303);

  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return fail("telegram");
  }

  const telegramUser = verifyTelegramPayload(
    params,
    env.TELEGRAM_BOT_TOKEN,
  );

  if (!telegramUser) {
    return fail("telegram");
  }

  try {
    const { session, user } = await signInWithTelegram(telegramUser);
    await safeEnsureProfile({ $id: user.$id, name: user.name });
    const response = NextResponse.redirect(new URL("/account", baseUrl), 303);
    response.cookies.set(
      SESSION_COOKIE,
      session.secret,
      sessionCookieOptions(session.expire),
    );
    return response;
  } catch (error) {
    console.error("[auth] telegram sign-in failed", error);
    return fail("telegram_unavailable");
  }
}
