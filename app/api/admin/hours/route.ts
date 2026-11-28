import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { audit } from "@/lib/domain/audit";
import { first, get, list, num, str, type Row } from "@/lib/domain/crud";
import { getBranchesSafe } from "@/lib/domain/directory";
import { getBarber } from "@/lib/domain/professional";
import { getHours, setHours } from "@/lib/domain/schedule";
import type { Scope } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z
  .object({
    barber: z.string().trim().min(1, "Pick a barber.").max(36),
    scope: z.enum(["barber", "branch"]).default("barber"),
    day: z
      .number()
      .int("Pick a weekday.")
      .min(0, "Pick a weekday.")
      .max(6, "Pick a weekday."),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.end > value.start, {
    message: "Closing time must be after opening time.",
    path: ["end"],
  });

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Pick an opening hour to remove.").max(36),
});

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function scopeOf(row: Row): Scope {
  return str(row.kind, "barber") === "branch" ? "branch" : "barber";
}

function hourOf(row: Row) {
  return {
    id: row.$id,
    barber: str(row.barber),
    scope: scopeOf(row),
    day: num(row.day),
    start: num(row.start),
    end: num(row.end),
  };
}

function signature(window: { day: number; start: number; end: number }): string {
  return `${window.day}:${window.start}:${window.end}`;
}

async function ownerExists(owner: string, scope: Scope): Promise<boolean> {
  if (scope === "barber") return Boolean(await getBarber(owner));
  return (await getBranchesSafe([owner])).has(owner);
}

/** GET /api/admin/hours — weekly windows for every chair and branch. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.hours, [Query.limit(200)]);
    const hours = rows
      .map(hourOf)
      .sort((a, b) =>
        a.barber === b.barber
          ? a.day - b.day || a.start - b.start
          : a.barber.localeCompare(b.barber),
      );
    return apiOk({ hours });
  } catch (error) {
    console.error("[admin] hours list failed", error);
    return apiError("Could not load opening hours.", 502, "hours_failed");
  }
}

/** POST /api/admin/hours — add one weekly window to an owner's template. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:hours:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the opening hours."), 400, "invalid_hours");
  }

  try {
    const data = parsed.data;
    if (!(await ownerExists(data.barber, data.scope))) {
      return apiError("That owner is not on the catalogue.", 404, "no_barber");
    }

    const current = await getHours(data.barber, data.scope);
    if (current.some((row) => signature(row) === signature(data))) {
      return apiError("That window already exists.", 409, "already_hours");
    }

    await setHours(data.barber, data.scope, [
      ...current.map(({ day, start, end }) => ({ day, start, end })),
      { day: data.day, start: data.start, end: data.end },
    ]);

    const row = await first(TABLES.hours, [
      Query.equal("barber", data.barber),
      Query.equal("kind", data.scope),
      Query.equal("day", data.day),
      Query.equal("start", data.start),
      Query.equal("end", data.end),
    ]);
    await audit({
      actor: guard.actor.userId,
      action: "schedule.hour",
      kind: data.scope,
      target: data.barber,
      detail: `${data.day} ${data.start}-${data.end}`,
    });
    return NextResponse.json(
      {
        ok: true as const,
        hour: row
          ? hourOf(row)
          : {
              id: "",
              barber: data.barber,
              scope: data.scope,
              day: data.day,
              start: data.start,
              end: data.end,
            },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin] hour create failed", error);
    return apiError("Could not save the opening hours.", 502, "hours_failed");
  }
}

/** DELETE /api/admin/hours?id=… — remove one weekly window. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:hours:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = deleteSchema.safeParse({
    id: request.nextUrl.searchParams.get("id"),
  });
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Pick an opening hour to remove."), 400, "invalid_id");
  }

  try {
    const row = await get(TABLES.hours, parsed.data.id);
    if (!row) return apiError("Opening hour not found.", 404, "not_found");

    const owner = str(row.barber);
    const scope = scopeOf(row);
    const target = signature({
      day: num(row.day),
      start: num(row.start),
      end: num(row.end),
    });
    const current = await getHours(owner, scope);
    await setHours(
      owner,
      scope,
      current
        .filter((window) => signature(window) !== target)
        .map(({ day, start, end }) => ({ day, start, end })),
    );
    await audit({
      actor: guard.actor.userId,
      action: "schedule.hour",
      kind: scope,
      target: owner,
      detail: `${target} removed`,
    });
    return apiOk();
  } catch (error) {
    console.error("[admin] hour delete failed", error);
    return apiError("Could not remove the opening hours.", 502, "hours_failed");
  }
}
