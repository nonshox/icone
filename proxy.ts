import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "icone_session";

/**
 * Cheap pre-render guard.
 *
 * This is **not** authentication: it only checks that a session cookie exists
 * so anonymous visitors get a real HTTP redirect instead of the account shell
 * plus a streamed client redirect. The page itself still validates the session
 * against Appwrite (`requireUser`), which handles revoked and expired cookies.
 *
 * Kept dependency-free on purpose: proxy runs before the app and must not
 * import server-only modules or the Appwrite SDK.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(signIn, 307);
}

export const config = {
  matcher: [
    "/account",
    "/account/:path*",
    "/book",
    "/bookings",
    "/bookings/:path*",
    "/agenda",
    "/agenda/:path*",
    "/admin",
    "/admin/:path*",
    "/customer",
    "/customer/:path*",
    "/barber",
    "/barber/:path*",
    "/favorites",
    "/notifications",
    "/settings",
    "/messages",
    "/messages/:path*",
  ],
};
