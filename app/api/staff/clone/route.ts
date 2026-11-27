import "server-only";

import { type NextRequest } from "next/server";

import {
  businessFailure,
  requireWorkspace,
  writeDenied,
} from "@/app/api/barber/_auth";
import { can, type Actor } from "@/lib/domain/access";
import { listBranches } from "@/lib/domain/business";
import { cloneWeek } from "@/lib/domain/schedule";
import type { Scope } from "@/lib/domain/types";
import { apiError, apiOk } from "@/lib/http";

type Target = { owner: string; scope: Scope; business?: string };

/**
 * The owner is always derived from the signed-in actor — never from the body.
 * A professional clones their own chair; an owner/manager without a chair
 * clones the branch they manage (or their primary branch as a last resort).
 */
async function targetOf(actor: Actor): Promise<Target | null> {
  if (actor.barber?.id) {
    return {
      owner: actor.barber.id,
      scope: "barber",
      business: actor.barber.business,
    };
  }

  const membership = actor.memberships.find(
    (row) =>
      row.branch &&
      (row.role === "owner" || row.role === "manager"),
  );
  if (membership?.branch) {
    return {
      owner: membership.branch,
      scope: "branch",
      business: membership.business,
    };
  }

  for (const business of actor.owns) {
    const branches = await listBranches(business);
    const branch =
      branches.find((row) => row.active && row.primary) ??
      branches.find((row) => row.active);
    if (branch) return { owner: branch.id, scope: "branch", business };
  }
  return null;
}

/** POST /api/staff/clone — copy the weekly template onto next week. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = writeDenied(request, `staff:clone:${guarded.actor.userId}`, 12);
  if (denied) return denied;

  let target: Target | null;
  try {
    target = await targetOf(guarded.actor);
  } catch (error) {
    return businessFailure(error, "Could not resolve your schedule.", "clone_failed");
  }
  if (!target) {
    return apiError("No schedule is linked to your account.", 400, "no_workspace");
  }

  // The workspace guard checked the first workspace; check the exact target too
  // so a per-membership denial on another business cannot be bypassed.
  const scope =
    target.scope === "barber"
      ? { barber: target.owner }
      : { business: target.business };
  if (!can(guarded.actor, "schedule.write", scope)) {
    return apiError("You do not have access to this schedule.", 403, "forbidden");
  }

  try {
    await cloneWeek(target.owner, target.scope);
    return apiOk();
  } catch (error) {
    return businessFailure(
      error,
      "Could not copy the week to next week.",
      "clone_failed",
    );
  }
}
