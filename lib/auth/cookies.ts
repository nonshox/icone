/**
 * Cookie names and options shared by route handlers and server components.
 * The session value is an Appwrite session secret: keep it HttpOnly.
 */
export const SESSION_COOKIE = "icone_session";
export const OTP_COOKIE = "icone_otp";

export const OTP_TTL_SECONDS = 10 * 60;

const isProduction = process.env.NODE_ENV === "production";

export function sessionCookieOptions(expire: string) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expire),
  };
}

export function otpCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
