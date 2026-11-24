import { NextResponse } from "next/server";

export type ApiErrorBody = {
  ok: false;
  error: { message: string; code: string };
};

export function apiError(
  message: string,
  status: number,
  code = "request_failed",
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { ok: false as const, error: { message, code } },
    { status },
  );
}

export function apiOk<T extends Record<string, unknown>>(
  data: T = {} as T,
): NextResponse<T & { ok: true }> {
  return NextResponse.json({ ok: true as const, ...data });
}

/**
 * Reject cross-site browser POSTs. Requests without an Origin header (curl,
 * server-to-server) are allowed; the session cookie is SameSite=Lax anyway.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function tooManyRequests(retryAfter: number): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      ok: false as const,
      error: {
        message: "Too many attempts. Please wait a moment and try again.",
        code: "rate_limited",
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}
