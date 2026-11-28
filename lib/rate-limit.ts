import "server-only";

import { createHash } from "node:crypto";
import { AppwriteException, type Models } from "node-appwrite";

import { adminDb, databaseId } from "@/lib/appwrite/db";

/**
 * Shared fixed-window limiter backed by a single Appwrite collection.
 *
 * Every serverless instance reads and writes the same `ratelimit` row, so a
 * burst spread across instances is counted once. The document id is a stable
 * hash of the caller-supplied key: no raw key (and no personal data) is stored
 * or logged, and the id is always a valid 36-character Appwrite id.
 */
const COLLECTION = "ratelimit";
const MAX_ATTEMPTS = 3;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

/** Appwrite ids allow 36 characters; 144 bits of SHA-256 is plenty here. */
export function rateLimitDocumentId(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 36);
}

function errorCode(error: unknown): number | null {
  if (error instanceof AppwriteException) return error.code;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "number") return code;
  }
  return null;
}

function isConflict(error: unknown): boolean {
  return errorCode(error) === 409;
}

function isNotFound(error: unknown): boolean {
  return errorCode(error) === 404;
}

/** Network timeouts, 5xx and Appwrite's own throttling are infrastructure. */
function isInfrastructure(error: unknown): boolean {
  const code = errorCode(error);
  if (code === null) return true;
  return code === 0 || code === 429 || code >= 500;
}

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function outcome(
  error: unknown,
  stage: string,
  id: string,
  open: RateLimitResult,
  closed: RateLimitResult,
): RateLimitResult {
  console.error(`[rate-limit] ${stage} failed for ${id}`, error);
  return isInfrastructure(error) ? open : closed;
}

/**
 * Consume one token for `key`. Forward-only: an expired row is reset, never
 * deleted. Concurrency is resolved with a small bounded retry loop; a create
 * that loses the race is simply re-read on the next attempt.
 *
 * Infrastructure failures fail open (availability beats an exact count) and
 * are logged. Application/configuration failures fail closed.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const id = rateLimitDocumentId(key);
  const db = adminDb();
  const database = databaseId();
  const now = Date.now();
  const expires = now + windowMs;
  const maxRetryAfter = Math.max(1, Math.ceil(windowMs / 1000));

  const allowed = (left: number): RateLimitResult => ({
    ok: true,
    remaining: Math.max(0, left),
    retryAfter: 0,
  });
  const denied = (retryAfter: number): RateLimitResult => ({
    ok: false,
    remaining: 0,
    retryAfter: Math.max(1, Math.ceil(retryAfter)),
  });
  const failOpen = allowed(limit);
  const failClosed = denied(maxRetryAfter);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let document: Models.DefaultDocument;
    try {
      document = await db.getDocument({
        databaseId: database,
        collectionId: COLLECTION,
        documentId: id,
      });
    } catch (error) {
      if (isNotFound(error)) {
        try {
          await db.createDocument({
            databaseId: database,
            collectionId: COLLECTION,
            documentId: id,
            data: { count: 1, expires },
          });
          return allowed(limit - 1);
        } catch (createError) {
          if (isConflict(createError) && attempt < MAX_ATTEMPTS) continue;
          return outcome(createError, "create", id, failOpen, failClosed);
        }
      }
      return outcome(error, "read", id, failOpen, failClosed);
    }

    const used = count(document.count);
    const resetAt = count(document.expires);

    if (resetAt <= now) {
      try {
        await db.updateDocument({
          databaseId: database,
          collectionId: COLLECTION,
          documentId: id,
          data: { count: 1, expires },
        });
        return allowed(limit - 1);
      } catch (error) {
        if (isConflict(error) && attempt < MAX_ATTEMPTS) continue;
        return outcome(error, "reset", id, failOpen, failClosed);
      }
    }

    if (used >= limit) {
      return denied(Math.ceil((resetAt - now) / 1000));
    }

    try {
      await db.updateDocument({
        databaseId: database,
        collectionId: COLLECTION,
        documentId: id,
        data: { count: used + 1, expires: resetAt },
      });
      return allowed(limit - used - 1);
    } catch (error) {
      if (isConflict(error) && attempt < MAX_ATTEMPTS) continue;
      return outcome(error, "increment", id, failOpen, failClosed);
    }
  }

  console.error(`[rate-limit] retries exhausted for ${id}`);
  return failClosed;
}

/**
 * Opaque bucket for requests that have no signed-in actor yet (OTP and Mini
 * App sign-in). The value is only a limiter key — it is never used as an
 * identity or an authorization decision. Proxy headers are what Vercel sends;
 * callers keep their existing key semantics.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return request.headers.get("x-real-ip") ?? "local";
}
