import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  setCategoryActive,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
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

/** GET /api/admin/categories — the service category list. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage categories.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      categories: await listCategories(),
    });
  } catch (error) {
    console.error("[admin] categories list failed", error);
    return apiError("Could not load categories.", 502, "categories_failed");
  }
}

/** POST /api/admin/categories — add a category. Admin only. */
export async function POST(request: NextRequest) {
  const guard = await writeGuard(request, "categories");
  if (guard) return guard;

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
    const category = await createCategory(parsed.data.name);
    return NextResponse.json({ ok: true as const, category }, { status: 201 });
  } catch (error) {
    console.error("[admin] category create failed", error);
    return apiError("Could not add the category.", 502, "category_failed");
  }
}

/** PATCH /api/admin/categories — rename or disable. Admin only. */
export async function PATCH(request: NextRequest) {
  const guard = await writeGuard(request, "categories");
  if (guard) return guard;

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
    const category =
      parsed.data.op === "active"
        ? await setCategoryActive(parsed.data.id, parsed.data.active)
        : await renameCategory(parsed.data.id, parsed.data.name);
    return NextResponse.json({ ok: true as const, category });
  } catch (error) {
    console.error("[admin] category update failed", error);
    return apiError("Could not update the category.", 502, "category_failed");
  }
}

/** DELETE /api/admin/categories?id=… — remove a category. Admin only. */
export async function DELETE(request: NextRequest) {
  const guard = await writeGuard(request, "categories");
  if (guard) return guard;

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
    await deleteCategory(parsed.data.id);
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[admin] category delete failed", error);
    return apiError("Could not remove the category.", 502, "category_failed");
  }
}

/** Shared admin guard for all category writes. Returns an error response or null. */
async function writeGuard(request: NextRequest, scope: string) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage categories.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change categories.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:${scope}:${member.user.id}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  return null;
}
