/**
 * Small in-memory fixed-window rate limiter.
 *
 * Good enough for a single Node process and local development. On a
 * multi-instance deployment move this to Appwrite/Redis (or enable Appwrite's
 * WAF rate limits) — see docs/AUTH.md.
 */
type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();
const MAX_KEYS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  if (store.size > MAX_KEYS) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) store.delete(entryKey);
    }
  }

  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}

/** Best-effort client IP. Trusts the platform proxy headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return request.headers.get("x-real-ip") ?? "local";
}
