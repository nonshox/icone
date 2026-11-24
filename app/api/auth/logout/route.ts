import "server-only";

import { Account } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";

import { createSessionClient } from "@/lib/appwrite/server";
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
} from "@/lib/auth/cookies";
import { apiError, isSameOrigin } from "@/lib/http";

/** POST /api/auth/logout — revoke the Appwrite session and clear the cookie. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const sessionSecret = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionSecret) {
    try {
      await new Account(createSessionClient(sessionSecret)).deleteSession({
        sessionId: "current",
      });
    } catch {
      // Already expired or revoked — clearing the cookie is enough.
    }
  }

  const response = NextResponse.json({ ok: true as const });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}
