import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  idSchema,
  readJson,
  requireWorkspace,
  writeDenied,
} from "@/app/api/barber/_auth";
import { TABLES } from "@/lib/appwrite/db";
import { can, type Actor } from "@/lib/domain/access";
import { listBranches } from "@/lib/domain/business";
import { get, list, num, str, type Row } from "@/lib/domain/crud";
import { addBreak, getBreaks, removeBreak } from "@/lib/domain/schedule";
import type { Scope } from "@/lib/domain/types";
import { apiError, apiOk } from "@/lib/http";

const createSchema = z
  .object({
    day: z.number().int().min(0, "Pick a weekday.").max(6, "Pick a weekday."),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(0).max(1440),
    note: z.string().trim().max(64).default(""),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

type Target = { owner: string; scope: Scope; business?: string };

function ownerQueries(owner: string, scope: Scope): string[] {
  return [Query.equal("barber", owner), Query.equal("kind", scope)];
}

function signature(row: {
  day: number;
  start: number;
  end: number;
  note: string;
}): string {
  return `${row.day}:${row.start}:${row.end}:${row.note}`;
}

/**
 * The owner is derived from the signed-in actor, never from the request. A
 * professional edits their own chair; an owner or manager without a chair
 * edits the branch they manage.
 */
async function targetOf(actor: Actor): Promise<Target | null> {
  if (actor.barber?.id) {
    return { owner: actor.barber.id, scope: "barber", business: actor.barber.business };
  }

  const membership = actor.memberships.find(
    (row) => row.branch && (row.role === "owner" || row.role === "manager"),
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

function scopeOf(target: Target): { barber?: string; business?: string } {
  return target.scope === "barber"
    ? { barber: target.owner }
    : { business: target.business };
}

async function breakWithId(
  target: Target,
  day: number,
  start: number,
  end: number,
  note = "",
): Promise<string> {
  const stored = await list(TABLES.breaks, [
    ...ownerQueries(target.owner, target.scope),
    Query.equal("day", day),
    Query.equal("start", start),
    Query.equal("end", end),
    Query.limit(1),
  ]);
  const match = stored.find((row) => str(row.note) === note) ?? stored[0];
  return match?.$id ?? "";
}

/** GET /api/staff/breaks — recurring breaks on the actor's own chair or branch. */
export async function GET() {
  const guarded = await requireWorkspace("calendar.read");
  if (!guarded.ok) return guarded.response;

  try {
    const target = await targetOf(guarded.actor);
    if (!target) return apiOk({ breaks: [] });
    if (!can(guarded.actor, "calendar.read", scopeOf(target))) {
      return apiError("You do not have access to this schedule.", 403, "forbidden");
    }

    const rows = await getBreaks(target.owner, target.scope);
    const stored = await list(TABLES.breaks, [
      ...ownerQueries(target.owner, target.scope),
      Query.limit(40),
    ]);
    const ids = new Map(stored.map((row) => [signature({
      day: num(row.day),
      start: num(row.start),
      end: num(row.end),
      note: str(row.note),
    }), row.$id]));

    return apiOk({
      breaks: rows.map((row) => ({
        ...row,
        id: ids.get(signature(row)) ?? "",
        barber: target.owner,
      })),
    });
  } catch (error) {
    return businessFailure(error, "Could not load the breaks.", "breaks_failed");
  }
}

/** POST /api/staff/breaks — add a recurring break. Repeated shapes are ignored. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:breaks:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the break details."),
      400,
      "invalid_break",
    );
  }

  try {
    const target = await targetOf(guarded.actor);
    if (!target) {
      return apiError("No schedule is linked to your account.", 400, "no_workspace");
    }
    if (!can(guarded.actor, "schedule.write", scopeOf(target))) {
      return apiError("You do not have access to this schedule.", 403, "forbidden");
    }

    const { day, start, end, note } = parsed.data;
    await addBreak({ owner: target.owner, scope: target.scope, day, start, end, note });
    return NextResponse.json(
      {
        ok: true as const,
        break: {
          id: await breakWithId(target, day, start, end, note),
          barber: target.owner,
          day,
          start,
          end,
          note,
          scope: target.scope,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return businessFailure(error, "Could not save the break.", "breaks_failed");
  }
}

/**
 * DELETE /api/staff/breaks — remove one break. Accepts `?id=`, `{ id }` or
 * `{ day, start, end }` so both the table and the form can remove one.
 */
export async function DELETE(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:breaks:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const selector: { id?: string; day?: number; start?: number; end?: number } = {};
  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    selector.id = idParam;
  } else {
    const json = await readJson(request);
    if (json.ok && typeof json.value === "object" && json.value !== null) {
      const value = json.value as Record<string, unknown>;
      if (typeof value.id === "string") selector.id = value.id;
      else if (
        typeof value.day === "number" &&
        typeof value.start === "number" &&
        typeof value.end === "number"
      ) {
        selector.day = value.day;
        selector.start = value.start;
        selector.end = value.end;
      }
    }
  }
  if (!selector.id && selector.day === undefined) {
    return apiError("Pick a break to remove.", 400, "invalid_id");
  }

  try {
    const target = await targetOf(guarded.actor);
    if (!target || !can(guarded.actor, "schedule.write", scopeOf(target))) {
      return apiError("You do not have access to this schedule.", 403, "forbidden");
    }

    let row: Row | null = null;
    if (selector.id) {
      const parsed = idSchema.safeParse(selector.id);
      if (!parsed.success) return apiError("Pick a break to remove.", 400, "invalid_id");
      row = await get(TABLES.breaks, parsed.data);
    } else {
      const found = await list(TABLES.breaks, [
        ...ownerQueries(target.owner, target.scope),
        Query.equal("day", selector.day!),
        Query.equal("start", selector.start!),
        Query.equal("end", selector.end!),
        Query.limit(1),
      ]);
      row = found[0] ?? null;
    }

    if (
      !row ||
      str(row.barber) !== target.owner ||
      str(row.kind, "barber") !== target.scope
    ) {
      return apiError("That break no longer exists.", 404, "not_found");
    }

    await removeBreak(row.$id);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the break.", "breaks_failed");
  }
}
