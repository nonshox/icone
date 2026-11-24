import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createBarber,
  findBarber,
  linkBarberUser,
  listAllBarbers,
  setBarberActive,
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

/** `{ id, active }` or `{ id, title?, bio?, photo?, user? }` — never both. */
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
      .object({ op: z.literal("active"), id: barberId, active: z.boolean() })
      .strict(),
    z
      .object({
        op: z.literal("edit"),
        id: barberId,
        title: z.string().trim().max(64).optional(),
        bio: z.string().trim().max(512).optional(),
        photo: z.string().trim().max(512).optional(),
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
    } else {
      const fields = {
        title: data.title,
        bio: data.bio,
        photo: data.photo,
        user: data.user,
      };
      if (Object.values(fields).every((value) => value === undefined)) {
        return apiError("Nothing to update.", 400, "invalid_barber");
      }

      // A chair change goes through the linker so the account leaves its old chair.
      if (fields.user !== undefined) {
        await linkBarberUser(fields.user ? data.id : "", fields.user);
      }

      const hasDetails =
        fields.title !== undefined ||
        fields.bio !== undefined ||
        fields.photo !== undefined;

      if (hasDetails) {
        barber = await updateBarber(data.id, {
          title: fields.title,
          bio: fields.bio,
          photo: fields.photo,
        });
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
