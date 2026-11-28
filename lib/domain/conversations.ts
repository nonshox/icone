import "server-only";

import { createHash } from "node:crypto";
import { AppwriteException, Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { create, first, list, num, str, update, type Row } from "./crud";
import type { Message } from "./messages";
import { notify } from "./notify";
import type { ConversationRecord } from "./types";

export type { ConversationRecord } from "./types";

/**
 * One row per direct-message pair.
 *
 * Messages still carry the pair in `conversation`, but the thread's mutable
 * state — preview, activity time and each side's unread counter — lives in a
 * single `conversations` row. That removes the global 300-message scan from
 * the inbox and gives both participants the same thread even when a hashed
 * pair key cannot be split apart.
 */

const CONVERSATIONS: string =
  (TABLES as Record<string, string>).conversations ?? "conversations";

const MAX_BODY = 1024;
const PAGE = 100;

/**
 * Canonical pair key: the two account ids sorted and joined with `|`.
 *
 * Appwrite ids never contain `|`, but historical import data can. Those ids
 * are hashed so the separator stays unambiguous; the record's `id1`/`id2`
 * columns remain the source of truth for participants in that case. The plain
 * form is byte-for-byte the legacy `conversationId()` value, so old messages
 * keep resolving to the same thread.
 */
export function pairKey(a: string, b: string): string {
  const ids = [a, b].filter(Boolean).sort();
  if (ids.length !== 2 || !ids[0] || !ids[1]) return "";
  if (ids.some((id) => id.includes("|"))) {
    const digest = createHash("sha1")
      .update(`${ids[0]}|${ids[1]}`)
      .digest("hex")
      .slice(0, 24);
    return `#${digest}`;
  }
  return `${ids[0]}|${ids[1]}`;
}

export function toMessage(row: Row): Message {
  return {
    id: row.$id,
    conversation: str(row.conversation),
    sender: str(row.sender),
    body: str(row.body),
    created: row.$createdAt,
  };
}

/**
 * `lastAt` is an epoch-millisecond integer in the current schema. Older and
 * string-based deployments carry an ISO value; both are exposed to callers as
 * an ISO timestamp so the inbox DTO never changes shape.
 */
function lastAtText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  return "";
}

/** Write in the representation the stored column already uses. */
function lastAtColumn(value: unknown, created: string): number | string {
  const parsed = Date.parse(created);
  if (typeof value === "string") return created;
  return Number.isFinite(parsed) ? parsed : 0;
}

function toConversation(row: Row): ConversationRecord {
  return {
    id: row.$id,
    pair: str(row.pair),
    id1: str(row.id1),
    id2: str(row.id2),
    last: str(row.last),
    lastAt: lastAtText(row.lastAt),
    unread1: num(row.unread1),
    unread2: num(row.unread2),
  };
}

/** Which column holds this account's unread count. */
function participantOf(
  record: ConversationRecord,
  userId: string,
): 1 | 2 | null {
  if (userId && record.id1 === userId) return 1;
  if (userId && record.id2 === userId) return 2;
  return null;
}

export function isParticipant(
  record: ConversationRecord,
  userId: string,
): boolean {
  return participantOf(record, userId) !== null;
}

/** The other account. Readers outside the pair get the first stored id. */
export function otherParty(
  record: ConversationRecord,
  userId: string,
): string | null {
  const slot = participantOf(record, userId);
  if (slot === 1) return record.id2 || null;
  if (slot === 2) return record.id1 || null;
  return record.id1 || record.id2 || null;
}

/** Unread messages waiting for this account. */
export function unreadFor(record: ConversationRecord, userId: string): number {
  const slot = participantOf(record, userId);
  if (slot === 1) return record.unread1;
  if (slot === 2) return record.unread2;
  return 0;
}

async function rowForPair(pair: string): Promise<Row | null> {
  if (!pair) return null;
  return first(CONVERSATIONS, [Query.equal("pair", pair)]);
}

export async function conversationForPair(
  pair: string,
): Promise<ConversationRecord | null> {
  const row = await rowForPair(pair);
  return row ? toConversation(row) : null;
}

/**
 * Read the row for a pair, creating it on first contact. The unique `pair`
 * index decides a race; the loser reads the winner instead of failing.
 */
export async function getOrCreateConversation(
  a: string,
  b: string,
): Promise<ConversationRecord | null> {
  const pair = pairKey(a, b);
  if (!pair) return null;

  const existing = await conversationForPair(pair);
  if (existing) return existing;

  try {
    // `lastAt` is left to the collection default: its column type differs
    // between schema revisions, and an untouched thread has no activity yet.
    const row = await create(CONVERSATIONS, {
      pair,
      id1: a,
      id2: b,
      last: "",
      unread1: 0,
      unread2: 0,
    });
    return toConversation(row);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const winner = await conversationForPair(pair);
      if (winner) return winner;
    }
    throw error;
  }
}

/** History for one pair. `viewer` is bypassed for admin read-only access. */
export async function messagesFor(
  pairOrRecord: string | ConversationRecord,
  viewer: string | null,
  limit = 100,
): Promise<Message[]> {
  const pair =
    typeof pairOrRecord === "string" ? pairOrRecord : pairOrRecord.pair;
  if (!pair) return [];
  if (
    viewer &&
    typeof pairOrRecord !== "string" &&
    !isParticipant(pairOrRecord, viewer)
  ) {
    return [];
  }

  const rows = await list(TABLES.messages, [
    Query.equal("conversation", pair),
    Query.orderAsc("$createdAt"),
    Query.limit(Math.min(Math.max(limit, 1), PAGE)),
  ]);
  return rows.map(toMessage);
}

/**
 * Write one message and refresh the thread preview in the same call.
 *
 * Appwrite has no transaction, so the message is written first: if the preview
 * update fails, the durable message still exists and the inbox can recover
 * from history. The counterpart's unread counter is bumped from a fresh read
 * so two quick sends do not silently overwrite each other.
 */
export async function appendMessage(input: {
  conversation: ConversationRecord;
  sender: string;
  body: string;
}): Promise<Message | null> {
  const body = input.body.trim().slice(0, MAX_BODY);
  const slot = participantOf(input.conversation, input.sender);
  if (!body || !slot) return null;

  const row = await create(TABLES.messages, {
    conversation: input.conversation.pair,
    sender: input.sender,
    body,
  });

  const raw = await rowForPair(input.conversation.pair);
  const fresh = raw ? toConversation(raw) : input.conversation;
  const unreadKey = slot === 1 ? "unread2" : "unread1";
  const nextUnread = num(slot === 1 ? fresh.unread2 : fresh.unread1) + 1;

  try {
    await update(CONVERSATIONS, fresh.id, {
      last: body,
      lastAt: lastAtColumn(raw?.lastAt, row.$createdAt),
      [unreadKey]: nextUnread,
    });
  } catch (error) {
    console.error("[conversations] preview update failed", error);
  }

  const other = slot === 1 ? fresh.id2 : fresh.id1;
  if (other) {
    await notify({ userId: other, key: "message", link: "/messages" });
  }

  return toMessage(row);
}

/** Clear one account's unread counter when they open the thread. */
export async function markRead(
  conversation: ConversationRecord | string,
  userId: string,
): Promise<void> {
  const record =
    typeof conversation === "string"
      ? await conversationForPair(conversation)
      : conversation;
  if (!record) return;

  const slot = participantOf(record, userId);
  if (!slot) return;
  const key = slot === 1 ? "unread1" : "unread2";
  if (num(slot === 1 ? record.unread1 : record.unread2) === 0) return;
  await update(CONVERSATIONS, record.id, { [key]: 0 });
}

/**
 * Threads that mention an account, newest activity first.
 *
 * The conversation table has one row per pair, so paging through it is cheap
 * compared with the old global message scan. Filtering in memory avoids a
 * hard dependency on id1/id2 secondary indexes.
 */
export async function listConversations(
  userId: string,
): Promise<ConversationRecord[]> {
  if (!userId) return [];

  const rows: Row[] = [];
  for (let offset = 0; offset < 5000; offset += PAGE) {
    const batch = await list(CONVERSATIONS, [
      Query.limit(PAGE),
      Query.offset(offset),
    ]);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  return rows
    .map(toConversation)
    .filter((record) => record.id1 === userId || record.id2 === userId)
    .sort((a, b) =>
      String(b.lastAt).localeCompare(String(a.lastAt)),
    );
}
