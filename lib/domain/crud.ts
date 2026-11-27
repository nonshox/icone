import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId } from "@/lib/appwrite/db";

export type Row = Models.Document & Record<string, unknown>;

/* ------------------------------------------------------------- field reads */

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Read a JSON blob column. Malformed data must never take a page down —
 * it degrades to the caller's fallback instead.
 */
export function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Trim, strip control characters and clamp to a column's size limit. */
export function clean(value: unknown, size: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, size);
}

/** Parse a +998 phone number down to digits, or "" when it is not valid. */
export function phone(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("998") && digits.length === 12) return digits;
  if (digits.length === 9) return `998${digits}`;
  return "";
}

/* --------------------------------------------------------------- crud core */

export async function get(table: string, id: string): Promise<Row | null> {
  if (!id) return null;
  try {
    return await adminDb().getDocument({
      databaseId: databaseId(),
      collectionId: table,
      documentId: id,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

export async function list(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

/** First row matching the queries, or null. */
export async function first(
  table: string,
  queries: string[],
): Promise<Row | null> {
  const rows = await list(table, [...queries, Query.limit(1)]);
  return rows[0] ?? null;
}

export async function count(table: string, queries: string[]): Promise<number> {
  const { total } = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries: [...queries, Query.limit(1)],
  });
  return total;
}

/** Fetch several documents by id in one request. */
export async function getMany(table: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const out: Row[] = [];
  // Chunk so a busy day's bookings never silently lose their names.
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50);
    out.push(...(await list(table, [Query.equal("$id", batch), Query.limit(50)])));
  }
  return out;
}

export async function create(
  table: string,
  data: Record<string, unknown>,
  documentId = ID.unique(),
): Promise<Row> {
  return (await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: table,
    documentId,
    data,
  })) as Row;
}

export async function update(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Row> {
  return (await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: table,
    documentId: id,
    data,
  })) as Row;
}

export async function remove(table: string, id: string): Promise<void> {
  await adminDb().deleteDocument({
    databaseId: databaseId(),
    collectionId: table,
    documentId: id,
  });
}

/**
 * Create a document, or read the one that beat us to it.
 *
 * Used for rows guarded by a unique index: two requests can both miss the
 * read and both attempt the insert, and only one wins. The loser gets the
 * winner's document instead of an error.
 */
export async function createOrGet(
  table: string,
  documentId: string,
  data: Record<string, unknown>,
): Promise<Row> {
  try {
    return await create(table, data, documentId);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const existing = await get(table, documentId);
      if (existing) return existing;
    }
    throw error;
  }
}

/** Bump a counter column and return the new value. */
export async function bump(
  table: string,
  id: string,
  key: string,
  delta: number,
): Promise<number> {
  const row = await get(table, id);
  if (!row) return 0;
  const next = Math.max(0, num(row[key]) + delta);
  await update(table, id, { [key]: next });
  return next;
}
