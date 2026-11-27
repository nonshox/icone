import "server-only";

import { Query } from "node-appwrite";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { createPlace, togglePlace } from "@/lib/domain/admin";
import { list } from "@/lib/domain/crud";
import { toPlace } from "@/lib/domain/directory";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const postSchema = z.object({
  name: z.string().trim().min(1, "Give the place a name.").max(64),
  kind: z.enum(["city", "district"]),
  parent: z.string().trim().max(36).optional(),
  ru: z.string().trim().max(64).optional(),
  en: z.string().trim().max(64).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const patchSchema = z.object({
  id: z.string().trim().min(1, "Pick a place.").max(36),
  active: z.boolean(),
});

/** GET /api/admin/places — every city and district, including disabled ones. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rows = await list(TABLES.places, [
      Query.orderAsc("sort"),
      Query.limit(200),
    ]);
    return apiOk({ places: rows.map(toPlace) });
  } catch (error) {
    console.error("[admin] places list failed", error);
    return apiError("Could not load places.", 502, "places_failed");
  }
}

/** POST /api/admin/places — add a city or district. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:places:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the place details.",
      400,
      "invalid_place",
    );
  }

  try {
    await createPlace(parsed.data);
    return apiOk();
  } catch (error) {
    console.error("[admin] place create failed", error);
    return apiError("Could not add the place.", 502, "place_failed");
  }
}

/** PATCH /api/admin/places — show or hide a city or district. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:places:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the place.", 400, "invalid_place");
  }

  try {
    await togglePlace(parsed.data.id, parsed.data.active);
    return apiOk();
  } catch (error) {
    console.error("[admin] place update failed", error);
    return apiError("Could not update the place.", 502, "place_failed");
  }
}
