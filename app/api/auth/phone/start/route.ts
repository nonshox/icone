import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { OTP_COOKIE, otpCookieOptions } from "@/lib/auth/cookies";
import { makeOtpCookie, normalizePhone, startPhoneLogin } from "@/lib/auth/phone";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicConfig } from "@/lib/public-config";

const schema = z.object({ phone: z.string().trim().min(7).max(32) });

/** POST /api/auth/phone/start — create a 4-digit code, delivered by the bot. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const limit = rateLimit(`phone:start:${clientIp(request)}`, 10, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) return apiError("Enter a valid phone number.", 400, "bad_phone");

  try {
    const { nonce } = await startPhoneLogin(phone);
    const botLink =
      `https://t.me/${publicConfig.telegramBotUsername}` +
      `?start=otp_${nonce}_${phone}`;

    const response = NextResponse.json({ ok: true as const, botLink });
    response.cookies.set(
      OTP_COOKIE,
      makeOtpCookie(phone, nonce),
      otpCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("[auth] phone code start failed", error);
    return apiError("Could not send your code. Try again.", 502, "otp_failed");
  }
}
