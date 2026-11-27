import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { servicesFor } from "@/lib/domain/catalog";
import { getBarber, isBookable } from "@/lib/domain/professional";
import { joinWaitlist, myWaits, cancelWait } from "@/lib/domain/waitlist";

const joinSchema = z.object({
  barber: z.string().trim().min(1).max(36),
  service: z.string().trim().max(36).optional(),
  business: z.string().trim().max(36).optional(),
  branch: z.string().trim().max(36).optional(),
  day: z.number().int().min(-1).max(6).optional(),
  before: z.number().int().min(0).max(1439).optional(),
  note: z.string().trim().max(200).optional(),
  window: z.number().int().min(1).max(60).optional(),
});

/** GET /api/waits — the member's waitlist requests. */
export async function GET() {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  try {
    return apiOk({ waits: await myWaits(guarded.actor.userId) });
  } catch (error) {
    console.error("[api] waitlist read failed", error);
    return apiError("Could not load the waitlist.", 502, "waits_failed");
  }
}

/** POST /api/waits — join a waitlist for a professional. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const limit = rateLimit(`wait:${guarded.actor.userId}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the details and try again.", 400, "invalid_wait");
  }

  // A waitlist service is a real id from this professional's menu, never free
  // text. Reject stale or fabricated ids before writing the request.
  const serviceId = parsed.data.service;
  if (serviceId) {
    const [barber, offered] = await Promise.all([
      getBarber(parsed.data.barber).catch(() => null),
      servicesFor(parsed.data.barber).catch(() => []),
    ]);
    if (
      !barber ||
      !isBookable(barber) ||
      !offered.some((item) => item.id === serviceId)
    ) {
      return apiError(
        "Pick a service this professional offers.",
        400,
        "invalid_service",
      );
    }
  }

  try {
    const wait = await joinWaitlist({
      ...parsed.data,
      user: guarded.actor.userId,
    });
    return NextResponse.json({ ok: true as const, wait }, { status: 201 });
  } catch (error) {
    console.error("[api] waitlist join failed", error);
    return apiError("Could not join the waitlist.", 502, "wait_failed");
  }
}

/** DELETE /api/waits?id=... — cancel one request. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return apiError("Pick a request.", 400, "no_id");

  try {
    const waits = await myWaits(guarded.actor.userId);
    if (!waits.some((row) => row.id === id)) {
      return apiError("This request is not yours.", 403, "forbidden");
    }
    await cancelWait(id);
    return apiOk();
  } catch (error) {
    console.error("[api] waitlist cancel failed", error);
    return apiError("Could not cancel the request.", 502, "wait_failed");
  }
}
