import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { OTP_COOKIE, otpCookieOptions } from "@/lib/auth/cookies";
import { makeOtpCookie, normalizePhone, startPhoneLogin } from "@/lib/auth/phone";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ phone: z.string().trim().max(32).optional() });

/** POST /api/auth/phone/start — one-tap Telegram share, or manual fallback. */
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
  if (!parsed.success) return apiError("Invalid phone number.", 400, "bad_phone");

  const raw = parsed.data.phone;
  const normalized = raw ? normalizePhone(raw) : null;
  const phone = normalized ?? undefined;
  if (raw && !normalized) {
    return apiError("Invalid phone number.", 400, "bad_phone");
  }

  try {
    const { nonce, botLink } = await startPhoneLogin(phone);
    const response = NextResponse.json({ ok: true as const, botLink });
    response.cookies.set(OTP_COOKIE, makeOtpCookie(nonce, phone ?? ""), otpCookieOptions());
    return response;
  } catch (error) {
    console.error("[auth] phone code start failed", error);
    return apiError("Could not send your code. Try again.", 502, "otp_failed");
  }
}
