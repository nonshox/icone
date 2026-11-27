import "server-only";

import { Databases } from "node-appwrite";

import { createAdminClient } from "./server";
import { serverEnv } from "@/lib/env";

/**
 * Table ids. One word each, matching the Appwrite collections created by
 * `scripts/setup-appwrite.mjs`.
 *
 * `payments` and `promotions` still exist in the live database from the
 * previous product but nothing in the code touches them any more.
 */
export const TABLES = {
  users: "users",
  barbers: "barbers",
  businesses: "businesses",
  branches: "branches",
  memberships: "memberships",
  invites: "invites",
  services: "services",
  empser: "empser",
  hours: "hours",
  breaks: "breaks",
  days: "days",
  bookings: "bookings",
  apptlog: "apptlog",
  clients: "clients",
  reviews: "reviews",
  favorites: "favorites",
  categories: "categories",
  places: "places",
  portfolio: "portfolio",
  reminders: "reminders",
  waits: "waits",
  notifications: "notifications",
  messages: "messages",
  applications: "applications",
  reports: "reports",
  tickets: "tickets",
  audit: "audit",
  settings: "settings",
} as const;

export type Table = (typeof TABLES)[keyof typeof TABLES];

/** Admin database client. Bypasses collection permissions — server only. */
export function adminDb(): Databases {
  return new Databases(createAdminClient());
}

export function databaseId(): string {
  return serverEnv().APPWRITE_DATABASE_ID;
}

/** Storage bucket for avatars, logos, covers and portfolio images. */
export function bucketId(): string {
  return serverEnv().APPWRITE_BUCKET_ID;
}
