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
import { get, list, num, str } from "@/lib/domain/crud";
import { ensureBarber } from "@/lib/domain/professional";
import { getHours, setHours } from "@/lib/domain/schedule";
import { apiError, apiOk } from "@/lib/http";

const createSchema = z
  .object({
    day: z.number().int().min(0, "Pick a weekday.").max(6, "Pick a weekday."),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

async function ownerId(actorUserId: string, name: string): Promise<string> {
  // A promoted barber can be missing their row; repair it before any write.
  const barber = await ensureBarber(actorUserId, { name });
  return barber.id;
}

function key(day: number, start: number, end: number): string {
  return `${day}:${start}:${end}`;
}

/** GET /api/staff/hours — the weekly windows on own chair. */
export async function GET() {
  const guarded = await requireWorkspace("calendar.read");
  if (!guarded.ok) return guarded.response;

  try {
    const owner = guarded.actor.barber?.id;
    if (!owner) return apiOk({ hours: [] });
    const rows = await getHours(owner, "barber");
    const stored = await list(TABLES.hours, [
      Query.equal("barber", owner),
      Query.equal("kind", "barber"),
      Query.limit(40),
    ]);
    const ids = new Map(
      stored.map((row) => [
        key(num(row.day), num(row.start), num(row.end)),
        row.$id,
      ]),
    );
    return apiOk({
      hours: rows.map((row) => ({
        ...row,
        id: ids.get(key(row.day, row.start, row.end)) ?? "",
        barber: owner,
      })),
    });
  } catch (error) {
    return businessFailure(error, "Could not load the opening hours.", "hours_failed");
  }
}

/** POST /api/staff/hours — add a weekly window to own chair. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:hours:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the opening hours."),
      400,
      "invalid_hours",
    );
  }

  try {
    const owner = await ownerId(guarded.actor.userId, guarded.actor.profile.name);
    const current = await getHours(owner, "barber");
    await setHours(owner, "barber", [...current, parsed.data]);

    const rows = await list(TABLES.hours, [
      Query.equal("barber", owner),
      Query.equal("kind", "barber"),
      Query.equal("day", parsed.data.day),
      Query.equal("start", Math.min(1439, parsed.data.start)),
      Query.equal("end", parsed.data.end),
      Query.limit(1),
    ]);
    return NextResponse.json(
      {
        ok: true as const,
        hour: {
          id: rows[0]?.$id ?? "",
          barber: owner,
          day: parsed.data.day,
          start: Math.min(1439, parsed.data.start),
          end: parsed.data.end,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return businessFailure(error, "Could not save the opening hours.", "hours_failed");
  }
}

/**
 * DELETE /api/staff/hours — remove a weekly window. Accepts `?id=`, `{ id }`
 * or `{ day, start }` so both the table and the form can remove one.
 */
export async function DELETE(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:hours:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const selector: { id?: string; day?: number; start?: number } = {};
  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    selector.id = idParam;
  } else {
    const json = await readJson(request);
    if (json.ok && typeof json.value === "object" && json.value !== null) {
      const value = json.value as Record<string, unknown>;
      if (typeof value.id === "string") selector.id = value.id;
      else if (typeof value.day === "number" && typeof value.start === "number") {
        selector.day = value.day;
        selector.start = value.start;
      }
    }
  }
  if (!selector.id && selector.day === undefined) {
    return apiError("Pick opening hours to remove.", 400, "invalid_id");
  }

  try {
    const owner = await ownerId(guarded.actor.userId, guarded.actor.profile.name);
    let row: Awaited<ReturnType<typeof get>> = null;
    if (selector.id) {
      const parsed = idSchema.safeParse(selector.id);
      if (!parsed.success) return apiError("Pick opening hours to remove.", 400, "invalid_id");
      row = await get(TABLES.hours, parsed.data);
    } else {
      const found = await list(TABLES.hours, [
        Query.equal("barber", owner),
        Query.equal("kind", "barber"),
        Query.equal("day", selector.day!),
        Query.equal("start", selector.start!),
        Query.limit(1),
      ]);
      row = found[0] ?? null;
    }

    if (!row || str(row.barber) !== owner || str(row.kind, "barber") !== "barber") {
      return apiError("Those opening hours no longer exist.", 404, "not_found");
    }

    const current = await getHours(owner, "barber");
    await setHours(
      owner,
      "barber",
      current.filter(
        (window) =>
          !(
            window.day === num(row.day) &&
            window.start === num(row.start) &&
            window.end === num(row.end)
          ),
      ),
    );
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the opening hours.", "hours_failed");
  }
}
