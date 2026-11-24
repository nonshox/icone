import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId } from "@/lib/appwrite/db";

/** Matches the collection created by `scripts/setup-appwrite.mjs`. */
const REMINDERS = "reminders";

type Row = Models.Document & Record<string, unknown>;

export type Reminder = {
  id: string;
  user: string;
  booking: string;
  date: string;
  at: number;
  state: string;
  tries: number;
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function toReminder(row: Row): Reminder {
  return {
    id: row.$id,
    user: str(row.user),
    booking: str(row.booking),
    date: str(row.date),
    at: num(row.at),
    state: str(row.state, "pending"),
    tries: num(row.tries),
  };
}

/**
 * Queue a reminder. A 409 means the unique `once` index already has a row for
 * this booking — that is the normal repeat-run case, not an error.
 *
 * Returns true only when a new row was created.
 */
export async function ensureReminder(data: {
  user: string;
  booking: string;
  date: string;
  at: number;
}): Promise<boolean> {
  try {
    await adminDb().createDocument({
      databaseId: databaseId(),
      collectionId: REMINDERS,
      documentId: ID.unique(),
      data: { ...data, state: "pending", tries: 0 },
    });
    return true;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) return false;
    throw error;
  }
}

/** Pending reminders due on `nowDate` inside [fromMinute, toMinute]. */
export async function listDue(
  nowDate: string,
  fromMinute: number,
  toMinute: number,
): Promise<Reminder[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: REMINDERS,
    queries: [
      Query.equal("date", nowDate),
      Query.equal("state", "pending"),
      Query.greaterThanEqual("at", fromMinute),
      Query.lessThanEqual("at", toMinute),
      Query.limit(100),
    ],
  });

  return (result.documents as Row[]).map(toReminder);
}

/** Close a reminder so no later run can deliver it twice. */
export async function markSent(id: string): Promise<void> {
  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: REMINDERS,
    documentId: id,
    data: { state: "sent" },
  });
}

/** Count a failed delivery. After the cap the row is closed for good. */
export async function markFailed(
  id: string,
  tries: number,
  maxTries: number,
): Promise<boolean> {
  const next = tries + 1;
  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: REMINDERS,
    documentId: id,
    data: next >= maxTries ? { tries: next, state: "sent" } : { tries: next },
  });
  return next >= maxTries;
}
