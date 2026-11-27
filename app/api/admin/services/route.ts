import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { createService, getService, toService, updateService } from "@/lib/domain/catalog";
import { audit } from "@/lib/domain/audit";
import { list } from "@/lib/domain/crud";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const ownerSchema = {
  barber: z.string().trim().max(36).optional(),
  business: z.string().trim().max(36).optional(),
};

const createSchema = z
  .object({
    ...ownerSchema,
    name: z.string().trim().min(1, "Give the service a name.").max(64),
    note: z.string().trim().max(256).default(""),
    price: z.number().int("Price must be a whole number of UZS.").min(0),
    time: z
      .number()
      .int("Duration must be a whole number of minutes.")
      .min(5, "Duration must be at least 5 minutes.")
      .max(480, "Duration cannot exceed 8 hours."),
  })
  .refine((value) => Boolean(value.barber || value.business), {
    message: "Choose a barber or business that owns this service.",
    path: ["barber"],
  });

const serviceId = z.string().trim().min(1, "Pick a service.").max(36);

/** `{ id, active }` or `{ id, name?, note?, price?, time? }` — never both. */
const patchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    return {
      ...(value as Record<string, unknown>),
      op: "active" in value ? "active" : "edit",
    };
  },
  z.discriminatedUnion("op", [
    z
      .object({ op: z.literal("active"), id: serviceId, active: z.boolean() })
      .strict(),
    z
      .object({
        op: z.literal("edit"),
        id: serviceId,
        name: z.string().trim().min(1).max(64).optional(),
        note: z.string().trim().max(256).optional(),
        price: z
          .number()
          .int("Price must be a whole number of UZS.")
          .min(0)
          .optional(),
        time: z
          .number()
          .int("Duration must be a whole number of minutes.")
          .min(5)
          .max(480)
          .optional(),
      })
      .strict(),
  ]),
);

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** GET /api/admin/services — the full menu, including inactive rows. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.services, [
      Query.orderAsc("sort"),
      Query.limit(200),
    ]);
    return apiOk({ services: rows.map(toService) });
  } catch (error) {
    console.error("[admin] services list failed", error);
    return apiError("Could not load services.", 502, "services_failed");
  }
}

/** POST /api/admin/services — add a service to a barber or business. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:services:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the service details."), 400, "invalid_service");
  }

  try {
    const data = parsed.data;
    const service = await createService({
      name: data.name,
      note: data.note,
      price: data.price,
      time: data.time,
      barber: data.barber ?? "",
      business: data.business ?? "",
    });
    await audit({
      actor: guard.actor.userId,
      action: "settings.change",
      kind: "service",
      target: service.id,
      detail: "created",
    });
    return NextResponse.json({ ok: true as const, service }, { status: 201 });
  } catch (error) {
    console.error("[admin] service create failed", error);
    return apiError("Could not add the service.", 502, "service_failed");
  }
}

/** PATCH /api/admin/services — put a menu item on or off sale, or edit it. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:services:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the service details."), 400, "invalid_service");
  }

  try {
    const data = parsed.data;
    if (!(await getService(data.id))) {
      return apiError("Service not found.", 404, "not_found");
    }

    const service =
      data.op === "active"
        ? await updateService(data.id, { active: data.active })
        : await updateService(data.id, {
            name: data.name,
            note: data.note,
            price: data.price,
            time: data.time,
          });

    await audit({
      actor: guard.actor.userId,
      action: "settings.change",
      kind: "service",
      target: data.id,
      detail: data.op,
    });
    return apiOk({ service });
  } catch (error) {
    console.error("[admin] service update failed", error);
    return apiError("Could not update the service.", 502, "service_failed");
  }
}
