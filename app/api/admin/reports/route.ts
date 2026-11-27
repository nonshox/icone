import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { computeStats, lastDays } from "@/lib/domain/stats";
import { apiError, apiOk } from "@/lib/http";

const querySchema = z.object({
  days: z
    .enum(["30", "90", "365"])
    .optional()
    .transform((value) => Number(value ?? "30")),
});

/** GET /api/admin/reports?days=30|90|365 — figures from real appointments. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse({
    days: request.nextUrl.searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("Pick a valid date range.", 400, "invalid_range");
  }

  try {
    const days = parsed.data.days;
    const range = lastDays(days);
    const stats = await computeStats({ range });

    return apiOk({
      report: {
        ...stats,
        days,
        from: range.from,
        to: range.to,
        series: {
          bookings: stats.byDay,
          services: stats.byService,
          barbers: stats.byBarber,
        },
        totals: {
          bookings: stats.total,
          done: stats.completed,
          cancel: stats.cancelled,
          noshow: stats.noShow,
        },
        popularServices: stats.byService,
        retention: stats.retention,
        cancellationRate: stats.cancelRate,
      },
    });
  } catch (error) {
    console.error("[admin] reports failed", error);
    return apiError("Could not build the report.", 502, "reports_failed");
  }
}
