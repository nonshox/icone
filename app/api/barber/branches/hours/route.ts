import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  readJson,
  writeDenied,
} from "@/app/api/barber/_auth";
import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { can, type Actor } from "@/lib/domain/access";
import { listBranches } from "@/lib/domain/business";
import { list, num } from "@/lib/domain/crud";
import { getHours, setHours } from "@/lib/domain/schedule";
import { apiError, apiOk } from "@/lib/http";

const windowSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const saveSchema = z.object({
  business: z.string().trim().max(36).optional(),
  branch: z.string().trim().min(1).max(36),
  windows: z.array(windowSchema).max(40),
});

const removeSchema = z.object({
  business: z.string().trim().max(36).optional(),
  branch: z.string().trim().min(1).max(36),
  all: z.boolean().optional(),
  day: z.number().int().min(0).max(6).optional(),
  start: z.number().int().min(0).max(1439).optional(),
});

function key(day: number, start: number, end: number): string {
  return `${day}:${start}:${end}`;
}

async function hoursWithIds(branch: string) {
  const rows = await getHours(branch, "branch");
  const stored = await list(TABLES.hours, [
    Query.equal("barber", branch),
    Query.equal("kind", "branch"),
    Query.limit(40),
  ]);
  const ids = new Map(
    stored.map((row) => [
      key(num(row.day), num(row.start), num(row.end)),
      row.$id,
    ]),
  );
  return rows.map((row) => ({
    ...row,
    id: ids.get(key(row.day, row.start, row.end)) ?? "",
  }));
}

async function resolve(
  actor: Actor,
  business: string | undefined,
  branch: string,
  capability: "branch.read" | "branch.manage",
): Promise<string | null> {
  const resolved =
    business ||
    actor.owns[0] ||
    actor.memberships.find((row) => row.branch === branch)?.business ||
    actor.memberships[0]?.business ||
    "";
  if (!resolved || !can(actor, capability, { business: resolved })) return null;
  const branches = await listBranches(resolved);
  return branches.some((row) => row.id === branch) ? resolved : null;
}

/** GET /api/barber/branches/hours?branch=… — weekly windows for one branch. */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const params = request.nextUrl.searchParams;
  let branch = params.get("branch") ?? "";
  const businessParam = params.get("business") ?? undefined;

  try {
    if (!branch) {
      const business =
        businessParam ||
        guarded.actor.owns[0] ||
        guarded.actor.memberships[0]?.business ||
        "";
      const branches = business ? await listBranches(business) : [];
      branch =
        branches.find((row) => row.active && row.primary)?.id ??
        branches[0]?.id ??
        "";
    }
    if (!branch) return apiOk({ branch: "", hours: [] });

    const business = await resolve(
      guarded.actor,
      businessParam,
      branch,
      "branch.read",
    );
    if (!business) {
      return apiError("You cannot see this branch.", 403, "forbidden");
    }
    return apiOk({ branch, hours: await hoursWithIds(branch) });
  } catch (error) {
    return businessFailure(error, "Could not load branch hours.", "hours_failed");
  }
}

/** POST /api/barber/branches/hours — replace a branch's weekly template. */
export async function POST(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const denied = await writeDenied(
    request,
    `barber:branch-hours:${guarded.actor.userId}`,
    60,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = saveSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the opening hours."),
      400,
      "invalid_hours",
    );
  }
  const { business, branch, windows } = parsed.data;

  try {
    const resolved = await resolve(guarded.actor, business, branch, "branch.manage");
    if (!resolved) {
      return apiError("You cannot manage this branch.", 403, "forbidden");
    }
    await setHours(branch, "branch", windows);
    return apiOk({ branch, hours: await hoursWithIds(branch) });
  } catch (error) {
    return businessFailure(error, "Could not save branch hours.", "hours_failed");
  }
}

/** DELETE /api/barber/branches/hours — clear all windows or remove one. */
export async function DELETE(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const denied = await writeDenied(
    request,
    `barber:branch-hours:${guarded.actor.userId}`,
    60,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = removeSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError("Pick opening hours to remove.", 400, "invalid_hours");
  }
  const { business, branch, all, day, start } = parsed.data;
  if (!all && (day === undefined || start === undefined)) {
    return apiError("Pick opening hours to remove.", 400, "invalid_hours");
  }

  try {
    const resolved = await resolve(guarded.actor, business, branch, "branch.manage");
    if (!resolved) {
      return apiError("You cannot manage this branch.", 403, "forbidden");
    }
    const current = await getHours(branch, "branch");
    await setHours(
      branch,
      "branch",
      all
        ? []
        : current.filter(
            (row) => !(row.day === day && row.start === start),
          ),
    );
    return apiOk({ branch, hours: await hoursWithIds(branch) });
  } catch (error) {
    return businessFailure(error, "Could not remove branch hours.", "hours_failed");
  }
}
