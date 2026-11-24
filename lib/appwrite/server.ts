import "server-only";

import { Client } from "node-appwrite";

import { serverEnv } from "@/lib/env";

/**
 * Admin client. Uses the project API key and bypasses user permissions.
 * Only use it for authentication flows and trusted server jobs.
 */
export function createAdminClient(): Client {
  const env = serverEnv();

  return new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);
}

/**
 * Session client. Acts as the end user for a single request.
 * Never cache or share an instance between requests.
 */
export function createSessionClient(sessionSecret: string): Client {
  const env = serverEnv();

  return new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setSession(sessionSecret);
}
