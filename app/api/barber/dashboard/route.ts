import "server-only";

import { businessFailure, requireWorkspace } from "@/app/api/barber/_auth";
import { barberDashboard, businessDashboard } from "@/lib/domain/stats";
import { apiOk } from "@/lib/http";

/**
 * GET /api/barber/dashboard — real numbers, scoped to one chair for a
 * professional and to the whole shop for an owner or manager.
 */
export async function GET() {
  const guarded = await requireWorkspace("analytics.read");
  if (!guarded.ok) return guarded.response;

  try {
    const { actor, workspace } = guarded;
    // An owner's home screen is the whole shop, even when they also cut hair.
    const owner = actor.owns.length > 0;
    const stats =
      workspace.barber && !owner
        ? await barberDashboard(workspace.barber, {
            rating: actor.barber?.rating ?? 0,
            views: actor.barber?.views ?? 0,
          })
        : await businessDashboard(workspace.business || actor.owns[0] || "");
    // `clients` is the current name; `customers` stays for older hooks.
    const dashboard = { ...stats, clients: stats.customers };
    return apiOk({ dashboard });
  } catch (error) {
    return businessFailure(error, "Could not load your dashboard.", "dashboard_failed");
  }
}
