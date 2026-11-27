import "server-only";

import { type NextRequest } from "next/server";

import { requireCap } from "@/lib/api/guard";
import { apiError } from "@/lib/http";
import { exportBookings } from "@/lib/domain/admin";
import { lastDays, RANGES, type RangeKey } from "@/lib/domain/stats";

/** GET /api/barber/export?range=month — operational CSV for the business owner. */
export async function GET(request: NextRequest) {
  const business = request.nextUrl.searchParams.get("business") ?? "";
  const guarded = await requireCap("export", business ? { business } : {});
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  const target =
    business || actor.owns[0] || actor.memberships.find((row) => row.role === "owner")?.business;
  if (!target) {
    return apiError("Only a business owner can export data.", 403, "forbidden");
  }
  if (target !== business && business) {
    return apiError("You cannot export this business.", 403, "forbidden");
  }

  const key = request.nextUrl.searchParams.get("range") ?? "";
  const rangeKey: RangeKey = key in RANGES ? (key as RangeKey) : "month";

  try {
    const csv = await exportBookings(target, lastDays(RANGES[rangeKey]));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="icone-${target}-${rangeKey}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api] export failed", error);
    return apiError("Could not export the data.", 502, "export_failed");
  }
}
