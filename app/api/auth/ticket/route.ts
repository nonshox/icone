import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { redeemWebLoginTicket } from "@/lib/auth/web-login";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/auth/ticket?ticket=…
 * Opens a one-time link from the Telegram Mini App in a normal browser and
 * establishes the same Appwrite session there. The link is signed, expires in
 * five minutes and is burned on first use.
 */
export async function GET(request: NextRequest) {
  const base = serverEnv().NEXT_PUBLIC_APP_URL;
  const fail = () =>
    NextResponse.redirect(new URL("/sign-in?error=link", base), 303);

  const limit = rateLimit("ticket:redeem:ip", 30, 10 * 60_000);
  if (!limit.ok) return fail();

  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket || ticket.length > 4096) return fail();

  try {
    const result = await redeemWebLoginTicket(ticket);
    if (!result) return fail();

    const response = NextResponse.redirect(new URL("/start", base), 303);
    response.cookies.set(
      SESSION_COOKIE,
      result.session.secret,
      sessionCookieOptions(result.session.expire),
    );
    return response;
  } catch (error) {
    console.error("[auth] website login ticket failed", error);
    return fail();
  }
}
