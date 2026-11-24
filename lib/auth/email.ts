import "server-only";

import { Account, ID, type Models } from "node-appwrite";

import { createAdminClient, createSessionClient } from "@/lib/appwrite/server";

/**
 * Send a 6-digit one-time code. Appwrite creates the account when the email is
 * new, so this is sign-up and sign-in in one step.
 */
export async function startEmailLogin(email: string): Promise<Models.Token> {
  const account = new Account(createAdminClient());

  return account.createEmailToken({
    userId: ID.unique(),
    email,
  });
}

/** Exchange the emailed code for a real Appwrite session. */
export async function completeEmailLogin(userId: string, code: string) {
  const adminClient = createAdminClient();
  const session = await new Account(adminClient).createSession({
    userId,
    secret: code,
  });

  // Confirm the fresh session works before we store it in a cookie.
  const user = await new Account(createSessionClient(session.secret)).get();

  return { session, user };
}
