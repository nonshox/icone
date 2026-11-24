import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createBarber,
  findBarber,
  linkBarberUser,
  listAllBarbers,
  setBarberActive,
  setBarberFeatured,
  updateBarber,
} from "@/lib/domain/admin";
import { currentMember, isStaff } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the barber a name.").max(64),
  title: z.string().trim().max(64),
  bio: z.string().trim().max(512),
});

const barberId = z.string().trim().min(1, "Pick a barber.").max(36);

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
        bio: z.string().trim().max(512).optional(),
        photo: z.string().trim().max(512).optional(),
        cover: z.string().trim().max(512).optional(),
        shop: z.string().trim().max(64).optional(),
        address: z.string().trim().max(128).optional(),
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

/** GET /api/admin/barbers — every chair, including inactive ones. Staff only. */
export async function GET() {
  const member = await currentMember();
  if (!member) return apiError("Sign in to manage the catalogue.", 401, "signed_out");
  if (!isStaff(member.profile.role)) {
    return apiError("Staff access only.", 403, "forbidden");
  }

  try {
    return NextResponse.json({
      ok: true as const,
      barbers: await listAllBarbers(),
    });
  } catch (error) {
    console.error("[admin] barbers list failed", error);
    return apiError("Could not load barbers.", 502, "barbers_failed");
  }
}

/** POST /api/admin/barbers — add a chair. Admin only. */
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

  const limit = rateLimit(`admin:barbers:${member.user.id}`, 60, 10 * 60_000);
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
    const barber = await createBarber(parsed.data);
    return NextResponse.json({ ok: true as const, barber }, { status: 201 });
  } catch (error) {
    console.error("[admin] barber create failed", error);
    return apiError("Could not add the barber.", 502, "barber_failed");
  }
}

/** PATCH /api/admin/barbers — take a chair online or offline. Admin only. */
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

  const limit = rateLimit(`admin:barbers:${member.user.id}`, 60, 10 * 60_000);
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
    let barber: Awaited<ReturnType<typeof setBarberActive>>;

    if (data.op === "active") {
      barber = await setBarberActive(data.id, data.active);
    } else if (data.op === "featured") {
      barber = await setBarberFeatured(data.id, data.featured);
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
      const hasDetails = Object.values(fields).some(
        (value) => value !== undefined,
      );
      if (!hasDetails && data.user === undefined) {
        return apiError("Nothing to update.", 400, "invalid_barber");
      }

      // A chair change goes through the linker so the account leaves its old chair.
      if (data.user !== undefined) {
        await linkBarberUser(data.user ? data.id : "", data.user);
      }

      if (hasDetails) {
        barber = await updateBarber(data.id, fields);
      } else {
        const current = await findBarber(data.id);
        if (!current) {
          return apiError("Barber not found.", 404, "barber_missing");
        }
        barber = current;
      }
    }

    return NextResponse.json({ ok: true as const, barber });
  } catch (error) {
    console.error("[admin] barber update failed", error);
    return apiError("Could not update the barber.", 502, "barber_failed");
  }
}
