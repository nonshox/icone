import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { OTP_COOKIE, otpCookieOptions } from "@/lib/auth/cookies";
import { startEmailLogin } from "@/lib/auth/email";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
});

/**
 * POST /api/auth/email/start
 * Sends a one-time code and stores the Appwrite user id in a short-lived,
 * HttpOnly cookie. The response never reveals whether the email is new.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const ip = clientIp(request);
  const ipLimit = rateLimit(`email:start:ip:${ip}`, 8, 10 * 60_000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Enter a valid email address.", 400, "invalid_email");
  }

  const email = parsed.data.email.toLowerCase();

  const emailLimit = rateLimit(`email:start:email:${email}`, 5, 10 * 60_000);
  if (!emailLimit.ok) return tooManyRequests(emailLimit.retryAfter);

  try {
    const token = await startEmailLogin(email);
    const response = NextResponse.json({ ok: true as const });
    response.cookies.set(OTP_COOKIE, token.userId, otpCookieOptions());
    return response;
  } catch (error) {
    console.error("[auth] could not start email login", error);
    return apiError(
      "We couldn't send the code. Try again in a moment.",
      502,
      "email_send_failed",
    );
  }
}
