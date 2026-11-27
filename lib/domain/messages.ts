import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { create, list, str, type Row } from "./crud";
import { toBarber } from "./professional";
import { notify } from "./notify";
import type { Barber } from "./types";

/**
 * Direct contact between a customer and a professional.
 *
 * A conversation id is the two account ids in a fixed order, so both sides
 * always land on the same thread. Messages never cross businesses: the
 * participant check happens before anything is written or read.
 */

const MAX_BODY = 1024;

export type Message = {
  id: string;
  conversation: string;
  sender: string;
  body: string;
  created: string;
};

export type Conversation = {
  id: string;
  with: string;
  withName: string;
  withAvatar: string;
  last: string;
  lastAt: string;
  unread: number;
};

/** `a|b` with the ids sorted, so order of opening does not matter. */
export function conversationId(a: string, b: string): string {
  return [a, b].filter(Boolean).sort().join("|");
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

export async function thread(
  conversation: string,
  viewer: string,
  limit = 100,
): Promise<Message[]> {
  if (!isParticipant(conversation, viewer)) return [];

  const rows = await list(TABLES.messages, [
    Query.equal("conversation", conversation),
    Query.orderAsc("$createdAt"),
    Query.limit(limit),
  ]);
  return rows.map(toMessage);
}

export async function send(input: {
  conversation: string;
  sender: string;
  body: string;
}): Promise<Message | null> {
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) return null;
  if (!isParticipant(input.conversation, input.sender)) return null;

  const row = await create(TABLES.messages, {
    conversation: input.conversation.slice(0, 80),
    sender: input.sender,
    body,
  });

  const other = otherParty(input.conversation, input.sender);
  if (other) {
    await notify({
      userId: other,
      key: "message",
      link: "/messages",
    });
  }

  return toMessage(row);
}

export function isParticipant(conversation: string, userId: string): boolean {
  return conversation.split("|").includes(userId);
}

export function otherParty(conversation: string, userId: string): string | null {
  return conversation.split("|").find((party) => party !== userId) ?? null;
}

/**
 * Every thread this account is in, newest activity first.
 *
 * The counterpart's display name comes from their professional row when there
 * is one, otherwise from their profile — a barber sees customers, a customer
 * sees the barber they wrote to.
 */
export async function conversationsFor(
  userId: string,
  names: Map<string, string>,
): Promise<Conversation[]> {
  const rows = await list(TABLES.messages, [
    Query.orderDesc("$createdAt"),
    Query.limit(300),
  ]);

  const mine = rows
    .map(toMessage)
    .filter((message) => isParticipant(message.conversation, userId));

  const byThread = new Map<string, Message[]>();
  for (const message of mine) {
    const bucket = byThread.get(message.conversation) ?? [];
    bucket.push(message);
    byThread.set(message.conversation, bucket);
  }

  const out: Conversation[] = [];
  for (const [id, messages] of byThread) {
    const sorted = [...messages].sort((a, b) => a.created.localeCompare(b.created));
    const last = sorted[sorted.length - 1];
    const other = otherParty(id, userId);
    if (!other || !last) continue;

    out.push({
      id,
      with: other,
      withName: names.get(other) ?? "",
      withAvatar: "",
      last: last.body,
      lastAt: last.created,
      unread: sorted.filter((message) => message.sender !== userId).length,
    });
  }

  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Resolve the display name for each counterpart in one pass. */
export async function counterpartNames(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const [barberRows, userRows] = await Promise.all([
    list(TABLES.barbers, [Query.equal("user", unique), Query.limit(100)]),
    list(TABLES.users, [Query.equal("$id", unique), Query.limit(100)]),
  ]);

  const names = new Map<string, string>();
  for (const row of userRows) names.set(row.$id, str(row.name));
  for (const row of barberRows) {
    const barber: Barber = toBarber(row);
    names.set(barber.user, barber.name);
  }
  return names;
}

/** Start or resume the thread between a customer and one professional. */
export async function openThread(customerId: string, barberId: string): Promise<string> {
  const [barberRow] = await list(TABLES.barbers, [
    Query.equal("$id", barberId),
    Query.limit(1),
  ]);
  if (!barberRow) return "";

  const barber = toBarber(barberRow);
  if (!barber.user) return "";
  return conversationId(customerId, barber.user);
}
