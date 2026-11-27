import "server-only";

import type { NextResponse } from "next/server";

import { getActor, can, type Actor, type Capability, type Scope } from "@/lib/domain/access";
import { apiError } from "@/lib/http";

export type Guarded =
  | { ok: true; actor: Actor }
  | { ok: false; response: NextResponse };

/** Signed-in account, any role. */
export async function requireUser(): Promise<Guarded> {
  const actor = await getActor();
  if (!actor) {
    return {
      ok: false,
      response: apiError("Sign in to continue.", 401, "signed_out"),
    };
  }
  return { ok: true, actor };
}

/** Signed-in account with a specific capability in an optional scope. */
export async function requireCap(
  capability: Capability,
  scope: Scope = {},
): Promise<Guarded> {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded;
  if (!can(guarded.actor, capability, scope)) {
    return {
      ok: false,
      response: apiError("You do not have access to this.", 403, "forbidden"),
    };
  }
  return guarded;
}

/** Platform admin only. */
export async function requireAdmin(): Promise<Guarded> {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded;
  if (guarded.actor.profile.role !== "admin") {
    return {
      ok: false,
      response: apiError("Admin access only.", 403, "forbidden"),
    };
  }
  return guarded;
}

export function failure(response: NextResponse): { ok: false; response: NextResponse } {
  return { ok: false, response };
}
