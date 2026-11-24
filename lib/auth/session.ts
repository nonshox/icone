import "server-only";

import { Account } from "node-appwrite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createSessionClient } from "@/lib/appwrite/server";

import { SESSION_COOKIE } from "./cookies";
import type { SessionUser } from "./types";
import { toSessionUser } from "./user";

/**
 * Read the current user from the HttpOnly Appwrite session cookie.
 * Memoised per render pass so layouts, pages and actions can call it freely.
 *
 * Must be rendered behind a <Suspense> boundary when Cache Components is on.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const sessionSecret = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionSecret) return null;

  try {
    const account = new Account(createSessionClient(sessionSecret));
    const user = await account.get();
    return toSessionUser(user);
  } catch {
    // Expired or revoked session: treat it as signed out.
    return null;
  }
});

/** Require a user or redirect to sign-in, preserving the return path. */
export async function requireUser(returnTo = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }

  return user;
}
