/**
 * Build the `conversations` table from historical `messages` rows.
 *
 *   node scripts/backfill-conversations.mjs
 *
 * One row per canonical pair, with the latest message as the preview and an
 * unread count per participant. Idempotent: a pair that already has a row is
 * left untouched, so live unread state is never reset. Nothing is deleted or
 * rewritten — messages and their conversation keys stay exactly as they are.
 *
 * The pair function mirrors lib/domain/conversations.ts byte for byte.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Client, Databases, ID, Query } from "node-appwrite";

function readEnv() {
  const file = fs.readFileSync(".env", "utf8");
  return Object.fromEntries(
    file
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = readEnv();
const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const db = new Databases(client);
const databaseId = env.APPWRITE_DATABASE_ID;
const MESSAGES = "messages";
const CONVERSATIONS = "conversations";
const PAGE = 100;

/** Same canonical key as the domain layer. */
function pairKey(a, b) {
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

/** Normalize an old pair value: it may be unsorted, but never re-hash it. */
function canonicalPair(value) {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("#")) return value;
  const parts = value.split("|");
  if (parts.length !== 2) return "";
  return pairKey(parts[0], parts[1]);
}

async function allMessages() {
  const rows = [];
  for (let offset = 0; offset < 100_000; offset += PAGE) {
    const batch = await db.listDocuments({
      databaseId,
      collectionId: MESSAGES,
      queries: [Query.limit(PAGE), Query.offset(offset)],
    });
    rows.push(...batch.documents);
    if (batch.documents.length < PAGE) break;
  }
  return rows;
}

/** The schema stores lastAt as epoch milliseconds. */
function lastAtValue(created) {
  const parsed = Date.parse(String(created ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hasPair(pair) {
  const found = await db.listDocuments({
    databaseId,
    collectionId: CONVERSATIONS,
    queries: [Query.equal("pair", pair), Query.limit(1)],
  });
  return found.documents.length > 0;
}

async function main() {
  const messages = await allMessages();
  const groups = new Map();

  for (const row of messages) {
    const sender = typeof row.sender === "string" ? row.sender : "";
    const pair = canonicalPair(row.conversation);
    if (!sender || !pair) continue;
    const bucket = groups.get(pair) ?? [];
    bucket.push(row);
    groups.set(pair, bucket);
  }

  let created = 0;
  let skipped = 0;
  let invalid = 0;
  let failed = 0;

  for (const [pair, rows] of groups) {
    let id1;
    let id2;

    if (pair.startsWith("#")) {
      // The hash hides the ids: recover them from the message senders.
      const senders = [...new Set(rows.map((row) => row.sender))].sort();
      if (senders.length !== 2) {
        invalid += 1;
        console.warn("[backfill] hashed pair without exactly two senders", {
          pair,
          senders: senders.length,
        });
        continue;
      }
      [id1, id2] = senders;
    } else {
      const parts = pair.split("|");
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        invalid += 1;
        continue;
      }
      [id1, id2] = parts;
    }

    if (await hasPair(pair)) {
      skipped += 1;
      continue;
    }

    const ordered = [...rows].sort((a, b) =>
      String(a.$createdAt ?? "").localeCompare(String(b.$createdAt ?? "")),
    );
    const latest = ordered[ordered.length - 1];

    // `unread1` is waiting for id1 (sent by id2); `unread2` is the reverse.
    let unread1 = 0;
    let unread2 = 0;
    for (const row of rows) {
      if (row.sender === id1) unread2 += 1;
      else if (row.sender === id2) unread1 += 1;
    }

    try {
      await db.createDocument({
        databaseId,
        collectionId: CONVERSATIONS,
        documentId: ID.unique(),
        data: {
          pair,
          id1,
          id2,
          last: String(latest.body ?? "").slice(0, 1024),
          lastAt: lastAtValue(latest.$createdAt),
          unread1,
          unread2,
        },
      });
      created += 1;
    } catch (error) {
      // A second run may have inserted the same pair between check and insert.
      if (await hasPair(pair)) {
        skipped += 1;
      } else {
        failed += 1;
        console.error("[backfill] could not create conversation", {
          pair,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.log(
    `[backfill] messages=${messages.length} pairs=${groups.size} created=${created} skipped=${skipped} invalid=${invalid} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[backfill] run failed", error);
  process.exitCode = 1;
});
