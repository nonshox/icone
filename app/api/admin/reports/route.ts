import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { listReports, resolveReport } from "@/lib/domain/admin";
import { computeStats, lastDays } from "@/lib/domain/stats";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  days: z
    .enum(["30", "90", "365"])
    .optional()
    .transform((value) => Number(value ?? "30")),
});

const reportState = z.enum(["open", "review", "resolved", "rejected"]);

const moderationQuerySchema = z.object({
  state: reportState.optional(),
});

const patchSchema = z.object({
  id: z.string().trim().min(1, "Pick a report.").max(36),
  state: reportState,
  detail: z.string().trim().max(512).default(""),
});

/**
 * GET /api/admin/reports
 *
 * `?state=…` reads the moderation queue. `?days=…` keeps the older analytics
 * report used by the reports page. Both live here because they share a path.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const days = params.get("days");

  if (days === null) {
    const parsed = moderationQuerySchema.safeParse({
      state: params.get("state") || undefined,
    });
    if (!parsed.success) {
      return apiError("Check the report filter.", 400, "invalid_filter");
    }

    try {
      return apiOk({ reports: await listReports(parsed.data.state) });
    } catch (error) {
      console.error("[admin] moderation reports list failed", error);
      return apiError("Could not load reports.", 502, "reports_failed");
    }
  }

  const parsed = querySchema.safeParse({ days });
  if (!parsed.success) {
    return apiError("Pick a valid date range.", 400, "invalid_range");
  }

  try {
    const range = lastDays(parsed.data.days);
    const stats = await computeStats({ range });

    return apiOk({
      report: {
        ...stats,
        days: parsed.data.days,
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

/** PATCH /api/admin/reports — resolve or reject a member's report. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:reports:${guard.actor.userId}`, 60, 10 * 60_000);
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
      parsed.error.issues[0]?.message ?? "Check the report.",
      400,
      "invalid_report",
    );
  }

  try {
    const { id, state, detail } = parsed.data;
    // resolveReport writes the audit row itself.
    await resolveReport(id, state, guard.actor.userId, detail);
    return apiOk();
  } catch (error) {
    console.error("[admin] report resolve failed", error);
    return apiError("Could not update the report.", 502, "report_failed");
  }
}
