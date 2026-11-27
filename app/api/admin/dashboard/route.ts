import "server-only";

import { overview } from "@/lib/domain/admin";
import { requireAdmin } from "@/lib/api/guard";
import { listAudit } from "@/lib/domain/audit";
import { computeStats, lastDays } from "@/lib/domain/stats";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/admin/dashboard — live platform figures and recent admin activity. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const [counts, stats, actions] = await Promise.all([
      overview(),
      computeStats({ range: lastDays(30) }),
      listAudit({ limit: 10 }),
    ]);

    return apiOk({
      stats: {
        ...counts,
        bookingsInRange: stats.total,
        byStatus: stats.byStatus,
        byDay: stats.byDay,
        byService: stats.byService,
        cancellationRate: stats.cancelRate,
        retention: stats.retention,
        recent: actions.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.action,
          detail: row.detail,
          at: row.at,
        })),
      },
    });
  } catch (error) {
    console.error("[admin] dashboard failed", error);
    return apiError("Could not load the dashboard.", 502, "dashboard_failed");
  }
}
