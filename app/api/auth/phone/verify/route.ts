import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  OTP_COOKIE,
  SESSION_COOKIE,
  otpCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { readOtpCookie, verifyPhoneLogin } from "@/lib/auth/phone";
import { ensureProfile, updateProfile } from "@/lib/domain/data";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code."),
});

/** POST /api/auth/phone/verify — code typed where the request started. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const limit = rateLimit(`phone:verify:${clientIp(request)}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const requestData = readOtpCookie(request.cookies.get(OTP_COOKIE)?.value);
  if (!requestData) {
    return apiError("The code expired. Request a new one.", 400, "expired_code");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Enter the 4-digit code.", 400, "invalid_code");
  }

  try {
    const result = await verifyPhoneLogin(requestData.nonce, parsed.data.code);
    if (!result.session) {
      return apiError(
        `Wrong code. ${result.triesLeft} tries left.`,
        400,
        "invalid_code",
      );
    }

    const userId = result.userId;
    await ensureProfile({ $id: userId, name: "Member" });
    await updateProfile(userId, { phone: result.phone });

    const response = NextResponse.json({ ok: true as const });
    response.cookies.set(
      SESSION_COOKIE,
      result.session.secret,
      sessionCookieOptions(result.session.expire),
    );
    response.cookies.set(OTP_COOKIE, "", { ...otpCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[auth] phone code verification failed", error);
    return apiError("Could not verify your code. Try again.", 502, "otp_failed");
  }
}
