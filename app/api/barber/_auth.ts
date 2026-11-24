import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { BarberBusinessError } from "@/lib/domain/barber-business";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export type BarberAuth =
  | { ok: true; userId: string; secret: string }
  | { ok: false; response: NextResponse };

/** Barber-only guard shared by every /api/barber route. */
export async function barberAuth(
  request: NextRequest,
  write = false,
): Promise<BarberAuth> {
  if (write && !isSameOrigin(request)) {
    return {
      ok: false,
      response: apiError(
        "This request came from an unexpected origin.",
        403,
        "bad_origin",
      ),
    };
  }

  const member = await currentMember();
  if (!member) {
    return {
      ok: false,
      response: apiError("Sign in to manage your business.", 401, "signed_out"),
    };
  }
  if (member.profile.role !== "barber") {
    return {
      ok: false,
      response: apiError("Barber access only.", 403, "forbidden"),
    };
  }

  if (write) {
    const limit = rateLimit(`barber:${member.user.id}`, 90, 10 * 60_000);
    if (!limit.ok) {
      return { ok: false, response: tooManyRequests(limit.retryAfter) };
    }
  }

  return {
    ok: true,
    userId: member.user.id,
    secret: request.cookies.get(SESSION_COOKIE)?.value ?? "",
  };
}

export type JsonResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

export async function readJson(request: NextRequest): Promise<JsonResult> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError("Invalid request body.", 400, "invalid_body"),
    };
  }
}

export function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export function businessFailure(
  error: unknown,
  fallback: string,
  code: string,
): NextResponse {
  if (error instanceof BarberBusinessError) {
    return apiError(error.message, error.status, error.code);
  }
  console.error("[barber] request failed", error);
  return apiError(fallback, 502, code);
}

export const idSchema = z.string().trim().min(1, "Pick a row.").max(36);
