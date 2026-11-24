import "server-only";

import { Databases } from "node-appwrite";

import { createAdminClient } from "./server";
import { serverEnv } from "@/lib/env";

/**
 * Table ids. One word each, matching the Appwrite collections created by
 * `scripts/setup-appwrite.mjs`.
 */
export const TABLES = {
  users: "users",
  barbers: "barbers",
  services: "services",
  hours: "hours",
  days: "days",
  bookings: "bookings",
  reviews: "reviews",
} as const;

export type Table = (typeof TABLES)[keyof typeof TABLES];

/** Admin database client. Bypasses collection permissions — server only. */
export function adminDb(): Databases {
  return new Databases(createAdminClient());
}

export function databaseId(): string {
  return serverEnv().APPWRITE_DATABASE_ID;
}
