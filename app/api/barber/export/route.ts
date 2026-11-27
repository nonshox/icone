import "server-only";

import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/api/guard";
import { can, inBusiness } from "@/lib/domain/access";
import { apiError } from "@/lib/http";
import { exportBookings } from "@/lib/domain/admin";
import { lastDays, RANGES, type RangeKey } from "@/lib/domain/stats";

/** GET /api/barber/export?range=month — operational CSV for the business owner. */
export async function GET(request: NextRequest) {
  const business = request.nextUrl.searchParams.get("business") ?? "";
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  const target =
    business || actor.owns[0] || actor.memberships.find((row) => row.role === "owner")?.business;
  const ownBarber = !target && actor.barber?.id ? actor.barber.id : "";

  if (target) {
    if (business && target !== business) {
      return apiError("You cannot export this business.", 403, "forbidden");
    }
    if (!inBusiness(actor, target) || !can(actor, "export", { business: target })) {
      return apiError("You cannot export this business.", 403, "forbidden");
    }
  } else if (!ownBarber) {
    return apiError("Only a professional can export their own data.", 403, "forbidden");
  }

  const key = request.nextUrl.searchParams.get("range") ?? "";
  const rangeKey: RangeKey = key in RANGES ? (key as RangeKey) : "month";

  try {
    const csv = await exportBookings(
      target ?? "",
      lastDays(RANGES[rangeKey]),
      ownBarber,
    );
    const label = target || ownBarber;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="icone-${label}-${rangeKey}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api] export failed", error);
    return apiError("Could not export the data.", 502, "export_failed");
  }
}
