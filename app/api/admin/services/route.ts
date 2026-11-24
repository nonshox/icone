import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createService,
  listAllServices,
  setServiceActive,
  updateService,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the service a name.").max(64),
  note: z.string().trim().max(256),
  price: z.number().int("Price must be a whole number of UZS.").min(0),
  time: z
    .number()
    .int("Duration must be a whole number of minutes.")
    .min(5, "Duration must be at least 5 minutes.")
    .max(240, "Duration cannot exceed 4 hours."),
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
          .min(5, "Duration must be at least 5 minutes.")
          .max(240, "Duration cannot exceed 4 hours.")
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
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      services: await listAllServices(),
    });
  } catch (error) {
    console.error("[admin] services list failed", error);
    return apiError("Could not load services.", 502, "services_failed");
  }
}

/** POST /api/admin/services — add a menu item. Admin only. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change the catalogue.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:services:${member.user.id}`, 60, 10 * 60_000);
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
    const service = await createService(parsed.data);
    return NextResponse.json({ ok: true as const, service }, { status: 201 });
  } catch (error) {
    console.error("[admin] service create failed", error);
    return apiError("Could not add the service.", 502, "service_failed");
  }
}

/** PATCH /api/admin/services — put a menu item on or off sale. Admin only. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }
  if (member.profile.role !== "admin") {
    return apiError("Only an admin can change the catalogue.", 403, "forbidden");
  }

  const limit = rateLimit(`admin:services:${member.user.id}`, 60, 10 * 60_000);
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
    let service: Awaited<ReturnType<typeof setServiceActive>>;

    if (data.op === "active") {
      service = await setServiceActive(data.id, data.active);
    } else {
      const fields = {
        name: data.name,
        note: data.note,
        price: data.price,
        time: data.time,
      };
      if (Object.values(fields).every((value) => value === undefined)) {
        return apiError("Nothing to update.", 400, "invalid_service");
      }
      service = await updateService(data.id, fields);
    }

    return NextResponse.json({ ok: true as const, service });
  } catch (error) {
    console.error("[admin] service update failed", error);
    return apiError("Could not update the service.", 502, "service_failed");
  }
}
