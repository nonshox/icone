import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import {
  listProfessionals,
  setBusinessState,
  verifyBusiness,
  verifyProfessional,
} from "@/lib/domain/admin";
import { audit } from "@/lib/domain/audit";
import { updateBarber } from "@/lib/domain/professional";
import type { ProState } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const id = z.string().trim().min(1, "Pick a professional.").max(36);

const querySchema = z.object({
  verified: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  q: z.string().trim().max(64).optional(),
});

/** One operation per professional: a verification flag or an account state. */
const patchSchema = z.union([
  z.object({
    id,
    kind: z.literal("barber"),
    verified: z.boolean().optional(),
    state: z.enum(["draft", "active", "suspended"]).optional(),
  }),
  z.object({
    id,
    kind: z.literal("business"),
    verified: z.boolean().optional(),
    state: z.enum(["draft", "review", "active", "suspended"]).optional(),
  }),
]);

/** GET /api/admin/professionals?verified=&q= — independent chairs to review. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    verified: params.get("verified") || undefined,
    q: params.get("q") || undefined,
  });
  if (!parsed.success) {
    return apiError("Check the professional filters.", 400, "invalid_filter");
  }

  try {
    const professionals = await listProfessionals({
      verified: parsed.data.verified,
      q: parsed.data.q,
    });
    return apiOk({ professionals });
  } catch (error) {
    console.error("[admin] professionals list failed", error);
    return apiError("Could not load professionals.", 502, "professionals_failed");
  }
}

/** PATCH /api/admin/professionals — verify a profile or change its state. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:professionals:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the professional.",
      400,
      "invalid_professional",
    );
  }

  const data = parsed.data;
  if (data.verified === undefined && data.state === undefined) {
    return apiError("Nothing to update.", 400, "invalid_professional");
  }

  try {
    const actor = guard.actor.userId;

    if (data.kind === "barber") {
      // verifyProfessional audits this change itself.
      if (data.verified !== undefined) {
        await verifyProfessional(data.id, data.verified, actor);
      }
      // updateBarber does not audit, so record the state change here.
      if (data.state !== undefined) {
        await updateBarber(data.id, { state: data.state as ProState });
        await audit({
          actor,
          action: data.state === "active" ? "user.restore" : "business.suspend",
          kind: "barber",
          target: data.id,
          detail: data.state,
        });
      }
    } else {
      // Both functions audit this change themselves.
      if (data.verified !== undefined) {
        await verifyBusiness(data.id, data.verified, actor);
      }
      if (data.state !== undefined) {
        await setBusinessState(data.id, data.state, actor);
      }
    }

    return apiOk();
  } catch (error) {
    console.error("[admin] professional update failed", error);
    return apiError("Could not update the professional.", 502, "professional_failed");
  }
}
