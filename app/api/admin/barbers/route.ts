import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { audit } from "@/lib/domain/audit";
import { get, list, update } from "@/lib/domain/crud";
import { createBarber, toBarber, updateBarber } from "@/lib/domain/professional";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const barberId = z.string().trim().min(1, "Pick a barber.").max(36);

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the barber a name.").max(64),
  title: z.string().trim().max(64).default(""),
  bio: z.string().trim().max(1024).default(""),
  user: z.string().trim().max(36).optional(),
});

/** One operation per request: active, featured, or a detail edit. */
const patchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    return {
      ...(value as Record<string, unknown>),
      op:
        "active" in value
          ? "active"
          : "featured" in value
            ? "featured"
            : "edit",
    };
  },
  z.discriminatedUnion("op", [
    z
      .object({ op: z.literal("active"), id: barberId, active: z.boolean() })
      .strict(),
    z
      .object({ op: z.literal("featured"), id: barberId, featured: z.boolean() })
      .strict(),
    z
      .object({
        op: z.literal("edit"),
        id: barberId,
        name: z.string().trim().min(1).max(64).optional(),
        title: z.string().trim().max(64).optional(),
        bio: z.string().trim().max(1024).optional(),
        photo: z.string().trim().max(512).optional(),
        cover: z.string().trim().max(512).optional(),
        shop: z.string().trim().max(64).optional(),
        address: z.string().trim().max(160).optional(),
        city: z.string().trim().max(64).optional(),
        years: z.number().int().min(0).max(80).optional(),
        skills: z.string().trim().max(256).optional(),
        phone: z.string().trim().max(32).optional(),
        social: z.string().trim().max(256).optional(),
        facilities: z.string().trim().max(256).optional(),
        policy: z.string().trim().max(512).optional(),
        confirm: z.boolean().optional(),
        featured: z.boolean().optional(),
        user: z.string().trim().max(36).optional(),
      })
      .strict(),
  ]),
);

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

async function barberView(id: string) {
  const row = await get(TABLES.barbers, id);
  return row ? toBarber(row) : null;
}

/** GET /api/admin/barbers — every professional row, including inactive ones. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.barbers, [
      Query.orderDesc("$createdAt"),
      Query.limit(200),
    ]);
    return apiOk({ barbers: rows.map(toBarber) });
  } catch (error) {
    console.error("[admin] barbers list failed", error);
    return apiError("Could not load barbers.", 502, "barbers_failed");
  }
}

/** POST /api/admin/barbers — add a chair. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:barbers:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the barber details."), 400, "invalid_barber");
  }

  try {
    const barber = await createBarber({
      user: parsed.data.user ?? "",
      name: parsed.data.name,
      title: parsed.data.title,
      bio: parsed.data.bio,
    });
    await audit({
      actor: guard.actor.userId,
      action: "settings.change",
      kind: "barber",
      target: barber.id,
      detail: "created",
    });
    return NextResponse.json({ ok: true as const, barber }, { status: 201 });
  } catch (error) {
    console.error("[admin] barber create failed", error);
    return apiError("Could not add the barber.", 502, "barber_failed");
  }
}

/** PATCH /api/admin/barbers — active, featured or a detail edit. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:barbers:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the barber details."), 400, "invalid_barber");
  }

  try {
    const data = parsed.data;

    if (data.op === "active") {
      await updateBarber(data.id, { active: data.active });
    } else if (data.op === "featured") {
      await updateBarber(data.id, { featured: data.featured });
    } else {
      const fields = {
        name: data.name,
        title: data.title,
        bio: data.bio,
        photo: data.photo,
        cover: data.cover,
        shop: data.shop,
        address: data.address,
        city: data.city,
        years: data.years,
        skills: data.skills,
        phone: data.phone,
        social: data.social,
        facilities: data.facilities,
        policy: data.policy,
        confirm: data.confirm,
        featured: data.featured,
      };
      const hasDetails = Object.values(fields).some((value) => value !== undefined);
      if (!hasDetails && data.user === undefined) {
        return apiError("Nothing to update.", 400, "invalid_barber");
      }
      if (hasDetails) await updateBarber(data.id, fields);

      // A chair change must also remove the account from its old chair.
      if (data.user !== undefined) {
        await update(TABLES.barbers, data.id, { user: data.user });
        if (data.user) {
          const others = await list(TABLES.barbers, [
            Query.equal("user", data.user),
            Query.limit(50),
          ]);
          await Promise.all(
            others
              .filter((row) => row.$id !== data.id)
              .map((row) => update(TABLES.barbers, row.$id, { user: "" })),
          );
        }
      }
    }

    const barber = await barberView(data.id);
    if (!barber) return apiError("Barber not found.", 404, "barber_missing");

    await audit({
      actor: guard.actor.userId,
      action: "settings.change",
      kind: "barber",
      target: data.id,
      detail: data.op,
    });
    return apiOk({ barber });
  } catch (error) {
    console.error("[admin] barber update failed", error);
    return apiError("Could not update the barber.", 502, "barber_failed");
  }
}
