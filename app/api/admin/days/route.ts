import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { audit } from "@/lib/domain/audit";
import { bool, first, get, list, num, str, type Row } from "@/lib/domain/crud";
import { getBranchesSafe } from "@/lib/domain/directory";
import { getBarber } from "@/lib/domain/professional";
import { clearDay, setDay } from "@/lib/domain/schedule";
import { isDate } from "@/lib/domain/time";
import type { Scope } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const scopeSchema = z.enum(["barber", "branch"]).default("barber");

const createSchema = z
  .object({
    barber: z.string().trim().min(1, "Pick a barber.").max(36),
    scope: scopeSchema,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date as YYYY-MM-DD.")
      .refine(isDate, "Pick a real date."),
    open: z.boolean(),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
    note: z.string().trim().max(64),
  })
  .refine((value) => !value.open || value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an override to remove.").max(36),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function scopeOf(row: Row): Scope {
  return str(row.kind, "barber") === "branch" ? "branch" : "barber";
}

function dayOf(row: Row) {
  return {
    id: row.$id,
    barber: str(row.barber),
    scope: scopeOf(row),
    date: str(row.date),
    open: bool(row.open),
    start: num(row.start),
    end: num(row.end),
    note: str(row.note),
  };
}

async function ownerExists(owner: string, scope: Scope): Promise<boolean> {
  if (scope === "barber") return Boolean(await getBarber(owner));
  return (await getBranchesSafe([owner])).has(owner);
}

/** GET /api/admin/days — every date override, with its owning chair or branch. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.days, [
      Query.orderAsc("date"),
      Query.limit(200),
    ]);
    return apiOk({ days: rows.map(dayOf) });
  } catch (error) {
    console.error("[admin] days list failed", error);
    return apiError("Could not load date overrides.", 502, "days_failed");
  }
}

/** POST /api/admin/days — add, replace or clear an owner's override for a date. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:days:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the date override."), 400, "invalid_day");
  }

  try {
    const data = parsed.data;
    if (!(await ownerExists(data.barber, data.scope))) {
      return apiError("That owner is not on the catalogue.", 404, "no_barber");
    }

    await setDay({
      owner: data.barber,
      scope: data.scope,
      date: data.date,
      open: data.open,
      start: data.start,
      end: data.end,
      note: data.note,
    });

    const row = await first(TABLES.days, [
      Query.equal("barber", data.barber),
      Query.equal("kind", data.scope),
      Query.equal("date", data.date),
    ]);
    await audit({
      actor: guard.actor.userId,
      action: "schedule.day",
      kind: data.scope,
      target: data.barber,
      detail: `${data.date} ${data.open ? "open" : "closed"}`,
    });
    return NextResponse.json({ ok: true as const, day: row ? dayOf(row) : null }, { status: 201 });
  } catch (error) {
    console.error("[admin] day save failed", error);
    return apiError("Could not save the date override.", 502, "days_failed");
  }
}

/** DELETE /api/admin/days?id=… — remove one override. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:days:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick an override to remove."), 400, "invalid_id");
  }

  try {
    const row = await get(TABLES.days, parsed.data.id);
    if (!row) return apiError("Override not found.", 404, "not_found");
    await clearDay(str(row.barber), scopeOf(row), str(row.date));
    await audit({
      actor: guard.actor.userId,
      action: "schedule.day",
      kind: scopeOf(row),
      target: str(row.barber),
      detail: `${str(row.date)} cleared`,
    });
    return apiOk();
  } catch (error) {
    console.error("[admin] day delete failed", error);
    return apiError("Could not remove the date override.", 502, "days_failed");
  }
}
