import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { createCategory, toggleCategory } from "@/lib/domain/admin";
import { audit } from "@/lib/domain/audit";
import { bool, clean, first, get, list, str, update, type Row } from "@/lib/domain/crud";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const name = z.string().trim().min(1, "Give the category a name.").max(32);
const id = z.string().trim().min(1, "Pick a category.").max(36);

/** `{ name }` to add, or `{ id, name }` / `{ id, active }` to change. */
const patchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    return {
      ...(value as Record<string, unknown>),
      op: "active" in value ? "active" : "rename",
    };
  },
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("active"), id, active: z.boolean() }).strict(),
    z.object({ op: z.literal("rename"), id, name }).strict(),
  ]),
);

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function categoryOf(row: Row) {
  return {
    id: row.$id,
    name: str(row.name),
    active: bool(row.active, true),
  };
}

/** Origin, admin role and rate limit in one step; the actor is reused by the caller. */
async function writeGuard(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:categories:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  return { actor: guard.actor };
}

/** GET /api/admin/categories — the service category list. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.categories, [
      Query.orderAsc("name"),
      Query.limit(100),
    ]);
    return NextResponse.json({ ok: true as const, categories: rows.map(categoryOf) });
  } catch (error) {
    console.error("[admin] categories list failed", error);
    return apiError("Could not load categories.", 502, "categories_failed");
  }
}

/** POST /api/admin/categories — add or reactivate a category. */
export async function POST(request: NextRequest) {
  const guard = await writeGuard(request);
  if (guard instanceof NextResponse) return guard;
  const actor = guard.actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = z.object({ name }).safeParse(body);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the category name."),
      400,
      "invalid_category",
    );
  }

  try {
    await createCategory(parsed.data.name, actor.userId);
    const row = await first(TABLES.categories, [
      Query.equal("name", clean(parsed.data.name, 32)),
    ]);
    if (!row) return apiError("Could not read that category.", 502, "category_failed");
    return NextResponse.json(
      { ok: true as const, category: categoryOf(row) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin] category create failed", error);
    return apiError("Could not add the category.", 502, "category_failed");
  }
}

/** PATCH /api/admin/categories — rename or enable/disable. */
export async function PATCH(request: NextRequest) {
  const guard = await writeGuard(request);
  if (guard instanceof NextResponse) return guard;
  const actor = guard.actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the category."),
      400,
      "invalid_category",
    );
  }

  try {
    const data = parsed.data;
    if (data.op === "active") {
      await toggleCategory(data.id, data.active);
    } else {
      await update(TABLES.categories, data.id, { name: clean(data.name, 32) });
    }

    const row = await get(TABLES.categories, data.id);
    if (!row) return apiError("Category not found.", 404, "not_found");

    await audit({
      actor: actor.userId,
      action: "settings.change",
      kind: "category",
      target: data.id,
      detail: data.op,
    });
    return NextResponse.json({ ok: true as const, category: categoryOf(row) });
  } catch (error) {
    console.error("[admin] category update failed", error);
    return apiError("Could not update the category.", 502, "category_failed");
  }
}

/** DELETE /api/admin/categories?id=… — retire a category without breaking services. */
export async function DELETE(request: NextRequest) {
  const guard = await writeGuard(request);
  if (guard instanceof NextResponse) return guard;
  const actor = guard.actor;

  const parsed = z
    .object({ id })
    .safeParse({ id: request.nextUrl.searchParams.get("id") });
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Pick a category."),
      400,
      "invalid_id",
    );
  }

  try {
    await toggleCategory(parsed.data.id, false);
    await audit({
      actor: actor.userId,
      action: "settings.change",
      kind: "category",
      target: parsed.data.id,
      detail: "disabled",
    });
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] category delete failed", error);
    return apiError("Could not remove the category.", 502, "category_failed");
  }
}
