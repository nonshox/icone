import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireCap, requireUser, type Guarded } from "@/lib/api/guard";
import type { Actor, Capability, Scope } from "@/lib/domain/access";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export { requireCap, requireUser, isSameOrigin };
export type { Guarded };

/**
 * The workspace a request acts on.
 *
 * Model A (independent barber) has a professional row and no business.
 * Model B (barbershop) has a business and, for barbers, a professional row too.
 * Both fields can be empty only for an account that is not set up yet.
 */
export type Workspace = { barber: string; business: string };

export function workspaceOf(actor: Actor): Workspace {
  if (actor.barber) {
    return { barber: actor.barber.id, business: actor.barber.business };
  }
  return {
    barber: "",
    business:
      actor.owns[0] ??
      actor.memberships.find((row) => row.barber)?.business ??
      actor.memberships[0]?.business ??
      "",
  };
}

export type WorkspaceGuarded =
  | { ok: true; actor: Actor; workspace: Workspace }
  | { ok: false; response: NextResponse };

/**
 * Resolve the signed-in actor, pick their workspace, then check the capability
 * against that exact scope. Every professional route starts here.
 */
export async function requireWorkspace(
  capability: Capability,
): Promise<WorkspaceGuarded> {
  const user = await requireUser();
  if (!user.ok) return user;

  const workspace: Scope = workspaceOf(user.actor);
  const guarded = await requireCap(capability, workspace);
  if (!guarded.ok) return guarded;

  return { ok: true, actor: user.actor, workspace: workspace as Workspace };
}

/** Same-origin check plus a fixed-window limit for write handlers. */
export function writeDenied(
  request: NextRequest,
  key: string,
  limit = 90,
): NextResponse | null {
  if (!isSameOrigin(request)) {
    return apiError(
      "This request came from an unexpected origin.",
      403,
      "bad_origin",
    );
  }
  const check = rateLimit(key, limit, 10 * 60_000);
  if (!check.ok) return tooManyRequests(check.retryAfter);
  return null;
}

export type JsonResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

export async function readJson(request: NextRequest): Promise<JsonResult> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError("Invalid request body.", 400, "invalid_body"),
    };
  }
}

export function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** Stable, non-leaking fallback for a failed domain call. */
export function businessFailure(
  error: unknown,
  fallback: string,
  code: string,
): NextResponse {
  console.error("[barber] request failed", error);
  return apiError(fallback, 502, code);
}

export const idSchema = z.string().trim().min(1, "Pick a row.").max(36);
