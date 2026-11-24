/**
 * Session cookie shared by route handlers and server components.
 * The value is an Appwrite session secret: keep it HttpOnly.
 */
export const SESSION_COOKIE = "icone_session";
export const OTP_COOKIE = "icone_otp";

export function otpCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 5 * 60,
  };
}

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

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
