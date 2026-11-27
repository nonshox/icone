import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { auditActions, listAudit } from "@/lib/domain/audit";
import { apiError, apiOk } from "@/lib/http";

const querySchema = z.object({
  action: z.string().trim().max(48).optional(),
  actor: z.string().trim().max(36).optional(),
  kind: z.string().trim().max(24).optional(),
  target: z.string().trim().max(36).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** GET /api/admin/audit — the append-only trail plus its known actions. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    action: params.get("action") || undefined,
    actor: params.get("actor") || undefined,
    kind: params.get("kind") || undefined,
    target: params.get("target") || undefined,
    limit: params.get("limit") || undefined,
  });
  if (!parsed.success) {
    return apiError("Check the audit filters.", 400, "invalid_filter");
  }

  try {
    const [entries, actions] = await Promise.all([
      listAudit(parsed.data),
      auditActions(),
    ]);
    return apiOk({ entries, actions });
  } catch (error) {
    console.error("[admin] audit list failed", error);
    return apiError("Could not load the audit trail.", 502, "audit_failed");
  }
}
