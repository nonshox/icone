import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
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
import { get, list, str, type Row } from "@/lib/domain/crud";
import { ensureBarber } from "@/lib/domain/professional";
import { clearDay, listDays, setDay } from "@/lib/domain/schedule";
import { isDate } from "@/lib/domain/time";
import { apiError, apiOk } from "@/lib/http";

const createSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date as YYYY-MM-DD.")
      .refine(isDate, "Pick a real date."),
    open: z.boolean(),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    note: z.string().trim().max(64, "Keep the note under 64 characters."),
  })
  .refine((value) => !value.open || value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

async function ownerId(actorUserId: string, name: string): Promise<string> {
  const barber = await ensureBarber(actorUserId, { name });
  return barber.id;
}

/** GET /api/staff/days — date overrides on own chair, soonest first. */
export async function GET() {
  const guarded = await requireWorkspace("calendar.read");
  if (!guarded.ok) return guarded.response;

  try {
    const owner = guarded.actor.barber?.id;
    if (!owner) return apiOk({ days: [] });
    const rows = await listDays(owner, "barber");
    const stored = await list(TABLES.days, [
      Query.equal("barber", owner),
      Query.equal("kind", "barber"),
      Query.limit(40),
    ]);
    const ids = new Map(stored.map((row) => [str(row.date), row.$id]));
    return apiOk({
      days: rows.map((row) => ({
        ...row,
        id: ids.get(row.date) ?? "",
        barber: owner,
      })),
    });
  } catch (error) {
    return businessFailure(error, "Could not load the date overrides.", "days_failed");
  }
}

/** POST /api/staff/days — add or replace one date override on own chair. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:days:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the date override."),
      400,
      "invalid_day",
    );
  }

  try {
    const owner = await ownerId(guarded.actor.userId, guarded.actor.profile.name);
    await setDay({ owner, scope: "barber", ...parsed.data });

    const rows = await list(TABLES.days, [
      Query.equal("barber", owner),
      Query.equal("kind", "barber"),
      Query.equal("date", parsed.data.date),
      Query.limit(1),
    ]);
    return apiOk({
      day: {
        id: rows[0]?.$id ?? "",
        barber: owner,
        date: parsed.data.date,
        open: parsed.data.open,
        start: Math.min(1439, parsed.data.start),
        end: parsed.data.end,
        note: parsed.data.note,
      },
    });
  } catch (error) {
    return businessFailure(error, "Could not save the date override.", "days_failed");
  }
}

/**
 * DELETE /api/staff/days — remove an override. Accepts `?id=`, `{ id }` or
 * `{ date }` so both the table and the form can remove one.
 */
export async function DELETE(request: NextRequest) {
  const guarded = await requireWorkspace("schedule.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `staff:days:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const selector: { id?: string; date?: string } = {};
  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    selector.id = idParam;
  } else {
    const json = await readJson(request);
    if (json.ok && typeof json.value === "object" && json.value !== null) {
      const value = json.value as Record<string, unknown>;
      if (typeof value.id === "string") selector.id = value.id;
      else if (typeof value.date === "string") selector.date = value.date;
    }
  }
  if (!selector.id && !selector.date) {
    return apiError("Pick an override to remove.", 400, "invalid_id");
  }

  try {
    const owner = await ownerId(guarded.actor.userId, guarded.actor.profile.name);
    let row: Row | null = null;
    if (selector.id) {
      const parsed = idSchema.safeParse(selector.id);
      if (!parsed.success) return apiError("Pick an override to remove.", 400, "invalid_id");
      row = await get(TABLES.days, parsed.data);
    } else {
      const found = await list(TABLES.days, [
        Query.equal("barber", owner),
        Query.equal("kind", "barber"),
        Query.equal("date", selector.date!),
        Query.limit(1),
      ]);
      row = found[0] ?? null;
    }

    if (!row || str(row.barber) !== owner || str(row.kind, "barber") !== "barber") {
      return apiError("That date override no longer exists.", 404, "not_found");
    }
    await clearDay(owner, "barber", str(row.date));
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the date override.", "days_failed");
  }
}
