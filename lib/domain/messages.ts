import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";

import { barberForUser, getMany, listUserBookings } from "./data";
import type { Role } from "./types";

/** Tables owned by the messaging feature (not in the shared TABLES map). */
const MESSAGES = "messages";
const NOTIFICATIONS = "notifications";

const SEPARATOR = "___";
const MAX_CONVERSATION = 80;
const PAGE = 100;
const MAX_PAGES = 10;

type Row = Models.Document & Record<string, unknown>;

export type Message = {
  id: string;
  conversation: string;
  sender: string;
  body: string;
  created: string;
};

export type Thread = {
  /** The other person's user id. */
  id: string;
  name: string;
  preview: string;
  /** ISO timestamp of the last message. */
  at: string;
  conversation: string;
};

export type Participant = { id: string; name: string };

/** Server-side view of the caller, passed by every route handler. */
export type Actor = { id: string; role: Role };

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toMessage(row: Row): Message {
  return {
    id: row.$id,
    conversation: str(row.conversation),
    sender: str(row.sender),
    body: str(row.body),
    created: row.$createdAt,
  };
}

async function list(collection: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: collection,
    queries,
  });
  return result.documents as Row[];
}

/**
 * Deterministic id for a pair of user ids. Sorting keeps both directions in
 * the same thread; the separator cannot appear in Appwrite ids.
 */
export function conversationId(first: string, second: string): string {
  const pair = [first, second].sort();
  return `${pair[0]}${SEPARATOR}${pair[1]}`.slice(0, MAX_CONVERSATION);
}

/** The two user ids held by a conversation id. */
export function conversationParts(conversation: string): string[] {
  return conversation.split(SEPARATOR);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const rows = await getMany(TABLES.users, ids);
  return new Map(rows.map((row) => [row.$id, str(row.name, "Member")]));
}

/**
 * User ids the caller is allowed to talk to, or `null` for an admin, who may
 * read every conversation but cannot send as somebody else.
 */
async function allowedPartners(actor: Actor): Promise<string[] | null> {
  if (actor.role === "admin") return null;

  if (actor.role === "barber") {
    const chair = await barberForUser(actor.id);
    if (!chair) return [];

    const rows = await list(TABLES.bookings, [
      Query.equal("barber", chair.id),
      Query.limit(PAGE),
    ]);
    return unique(rows.map((row) => str(row.user))).filter(
      (id) => id !== actor.id,
    );
  }

  const bookings = await listUserBookings(actor.id);
  const chairIds = unique(bookings.map((booking) => booking.barber));
  if (chairIds.length === 0) return [];

  const chairs = await getMany(TABLES.barbers, chairIds);
  return unique(chairs.map((row) => str(row.user))).filter(
    (id) => id !== actor.id,
  );
}

/** Every route checks this before reading or writing a thread. */
export async function canMessage(actor: Actor, otherId: string): Promise<boolean> {
  if (!otherId || otherId === actor.id) return false;
  if (actor.role === "admin") return false;

  if (actor.role === "barber") {
    const chair = await barberForUser(actor.id);
    if (!chair) return false;
    const rows = await list(TABLES.bookings, [
      Query.equal("barber", chair.id),
      Query.equal("user", otherId),
      Query.limit(1),
    ]);
    return rows.length > 0;
  }

  // A client may only reach the staff user linked to a chair they booked.
  const chairs = await list(TABLES.barbers, [
    Query.equal("user", otherId),
    Query.limit(50),
  ]);
  const chairIds = chairs.map((row) => row.$id);
  if (chairIds.length === 0) return false;

  const bookings = await list(TABLES.bookings, [
    Query.equal("user", actor.id),
    Query.equal("barber", chairIds),
    Query.limit(1),
  ]);
  return bookings.length > 0;
}

/** The staff user linked to a chair, used to open a thread from a booking. */
export async function staffUserForChair(chairId: string): Promise<string | null> {
  try {
    const row = await adminDb().getDocument({
      databaseId: databaseId(),
      collectionId: TABLES.barbers,
      documentId: chairId,
    });
    const user = str(row.user);
    return user || null;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

async function messagesIn(conversation: string): Promise<Message[]> {
  const rows = await list(MESSAGES, [
    Query.equal("conversation", conversation),
    Query.orderAsc("$createdAt"),
    Query.limit(PAGE),
  ]);
  return rows.map(toMessage);
}

async function lastMessage(conversation: string): Promise<Message | null> {
  const rows = await list(MESSAGES, [
    Query.equal("conversation", conversation),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  return rows.length > 0 ? toMessage(rows[0]!) : null;
}

async function allMessages(): Promise<Message[]> {
  const result: Message[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await list(MESSAGES, [
      Query.orderDesc("$createdAt"),
      Query.limit(PAGE),
      Query.offset(page * PAGE),
    ]);
    result.push(...rows.map(toMessage));
    if (rows.length < PAGE) break;
  }

  return result;
}

/** Thread list for the caller, with the other person and a last-message peek. */
export async function listThreads(actor: Actor): Promise<Thread[]> {
  let latest: Array<{ other: string; message: Message }> = [];

  if (actor.role === "admin") {
    const seen = new Set<string>();
    for (const message of await allMessages()) {
      const parts = conversationParts(message.conversation);
      const other = parts.find((id) => id !== actor.id);
      if (!other || seen.has(message.conversation)) continue;
      seen.add(message.conversation);
      latest.push({ other, message });
    }
  } else {
    const partners = (await allowedPartners(actor)) ?? [];
    const threads = await Promise.all(
      partners.slice(0, 50).map(async (other) => {
        const message = await lastMessage(conversationId(actor.id, other));
        return message ? { other, message } : null;
      }),
    );
    latest = threads.filter(
      (item): item is { other: string; message: Message } => item !== null,
    );
  }

  const label = await names(unique(latest.map((item) => item.other)));

  return latest
    .map(({ other, message }) => ({
      id: other,
      name: label.get(other) ?? "Member",
      preview: message.body,
      at: message.created,
      conversation: message.conversation,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Full history of one thread. Authorization belongs in the route handler. */
export async function getThread(
  actor: Actor,
  otherId: string,
): Promise<{ messages: Message[]; participant: Participant }> {
  return getThreadByConversation(conversationId(actor.id, otherId), actor.id);
}

/**
 * An admin is not a member of every thread, so its id — not the caller's id —
 * must select the history. Non-admins only reach this through `getThread`.
 */
export async function getThreadByConversation(
  conversation: string,
  viewer: string,
): Promise<{ messages: Message[]; participant: Participant }> {
  const parts = conversationParts(conversation);
  const otherId = parts.find((id) => id !== viewer) ?? parts[0] ?? "";
  const label = await names(parts);

  return {
    messages: await messagesIn(conversation),
    participant: {
      id: otherId,
      name: label.get(otherId) ?? "Member",
    },
  };
}

export async function createMessage(input: {
  conversation: string;
  sender: string;
  body: string;
}): Promise<Message> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: MESSAGES,
    documentId: ID.unique(),
    data: input,
  });
  return toMessage(row as Row);
}

/** In-app inbox row for the recipient. Never blocks delivery of a message. */
export async function createNotification(input: {
  user: string;
  title: string;
  body: string;
  kind: string;
}): Promise<void> {
  await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: NOTIFICATIONS,
    documentId: ID.unique(),
    data: { ...input, state: "new" },
  });
}
