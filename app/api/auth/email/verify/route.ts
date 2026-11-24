import "server-only";

import { AppwriteException } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  OTP_COOKIE,
  SESSION_COOKIE,
  otpCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { completeEmailLogin } from "@/lib/auth/email";
import { toSessionUser } from "@/lib/auth/user";
import { safeEnsureProfile } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

/**
 * POST /api/auth/email/verify
 * Exchanges the emailed one-time code for an HttpOnly Appwrite session.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const ip = clientIp(request);
  const ipLimit = rateLimit(`email:verify:ip:${ip}`, 20, 10 * 60_000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  const userId = request.cookies.get(OTP_COOKIE)?.value;
  if (!userId) {
    return apiError(
      "Your code expired. Request a new one.",
      400,
      "otp_expired",
    );
  }

  const userLimit = rateLimit(`email:verify:user:${userId}`, 10, 10 * 60_000);
  if (!userLimit.ok) return tooManyRequests(userLimit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Enter the 6-digit code from your email.",
      400,
      "invalid_code_format",
    );
  }

  try {
    const { session, user } = await completeEmailLogin(
      userId,
      parsed.data.code,
    );

    await safeEnsureProfile({ $id: user.$id, name: user.name });

    const response = NextResponse.json({
      ok: true as const,
      user: toSessionUser(user),
    });

    response.cookies.set(
      SESSION_COOKIE,
      session.secret,
      sessionCookieOptions(session.expire),
    );
    response.cookies.set(OTP_COOKIE, "", {
      ...otpCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    if (error instanceof AppwriteException) {
      if (error.code === 401) {
        return apiError(
          "That code is incorrect or has expired. Try again.",
          400,
          "invalid_code",
        );
      }

      if (error.code === 429) {
        return tooManyRequests(30);
      }

      console.error("[auth] email verify failed", {
        code: error.code,
        type: error.type,
      });
    } else {
      console.error("[auth] email verify crashed", error);
    }

    return apiError(
      "Something went wrong while signing you in. Try again.",
      502,
      "verify_failed",
    );
  }
}
