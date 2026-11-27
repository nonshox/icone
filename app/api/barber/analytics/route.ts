import "server-only";

import { type NextRequest } from "next/server";

import { can, inBusiness } from "@/lib/domain/access";
import { getBranch } from "@/lib/domain/business";
import { requireUser } from "@/lib/api/guard";
import {
  RANGES,
  computeStats,
  lastDays,
  popularServices,
  teamNames,
  type RangeKey,
} from "@/lib/domain/stats";
import { apiError, apiOk } from "@/lib/http";

/** GET /api/barber/analytics — real operational counts, never revenue. */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  const params = request.nextUrl.searchParams;
  let business = params.get("business") ?? undefined;
  const branch = params.get("branch") ?? undefined;
  let barber = params.get("barber") ?? undefined;
  const rangeKey = params.get("range") ?? "";
  const key: RangeKey =
    rangeKey in RANGES ? (rangeKey as RangeKey) : "month";
  const range = lastDays(RANGES[key]);

  // Never aggregate the whole platform. Without an explicit scope, fall back
  // to the actor's own chair or to a business they belong to.
  if (!business && !barber) {
    if (actor.barber) barber = actor.barber.id;
    else business = actor.owns[0] ?? actor.memberships[0]?.business;
  }
  if (!business && !barber) {
    return apiError("Pick a calendar or business to analyse.", 400, "no_scope");
  }
  if (
    business &&
    !can(actor, "analytics.read.all", { business }) &&
    !can(actor, "analytics.read", { business })
  ) {
    return apiError("You cannot see this business's analytics.", 403, "forbidden");
  }
  if (barber && !can(actor, "analytics.read", { barber })) {
    return apiError("You cannot see this calendar.", 403, "forbidden");
  }
  if (branch) {
    const row = await getBranch(branch);
    if (
      !row ||
      !business ||
      row.business !== business ||
      !inBusiness(actor, business)
    ) {
      return apiError("You cannot see this branch.", 403, "forbidden");
    }
  }

  try {
    const filter = {
      range,
      business: business || undefined,
      branch: branch || undefined,
      barber: barber || undefined,
      service: params.get("service") || undefined,
    };
    const [stats, popular, names] = await Promise.all([
      computeStats(filter),
      popularServices(filter, 8),
      business ? teamNames(business) : Promise.resolve(new Map<string, string>()),
    ]);

    return apiOk({
      range,
      stats,
      popular,
      team: [...names.entries()].map(([id, name]) => ({ id, name })),
    });
  } catch (error) {
    console.error("[api] analytics failed", error);
    return apiError("Could not load analytics.", 502, "analytics_failed");
  }
}
