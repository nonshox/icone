import "server-only";

import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/api/guard";
import { can, inBusiness } from "@/lib/domain/access";
import { getBarber, getBarbers, listBusinessBarbers } from "@/lib/domain/professional";
import { waitsForBarber } from "@/lib/domain/waitlist";
import { apiError, apiOk } from "@/lib/http";

/**
 * GET /api/barber/waits — open wait requests for the actor's own chair or for
 * every employee of a business they belong to. No writes: customers choose
 * their own slot, we only show what people are waiting for.
 */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;
  const params = request.nextUrl.searchParams;
  const requested = params.get("barber") ?? "";
  let business = params.get("business") ?? "";
  let barberIds: string[] = [];

  try {
    if (requested) {
      const employee = await getBarber(requested);
      if (!employee) return apiError("Professional not found.", 404, "no_barber");
      // Never let a client override the barber's actual business: that would
      // authorize against shop A while reading shop B's wait requests.
      business = employee.business;

      if (actor.barber?.id === requested) {
        if (!can(actor, "customer.read", { barber: requested })) {
          return apiError("You cannot see these requests.", 403, "forbidden");
        }
      } else if (
        !business ||
        !inBusiness(actor, business) ||
        !can(actor, "customer.read", { business })
      ) {
        return apiError("You cannot see these requests.", 403, "forbidden");
      }
      barberIds = [requested];
    } else if (actor.barber?.id) {
      if (!can(actor, "customer.read", { barber: actor.barber.id })) {
        return apiError("You cannot see these requests.", 403, "forbidden");
      }
      business = actor.barber.business;
      barberIds = [actor.barber.id];
    } else {
      business =
        business ||
        actor.owns[0] ||
        actor.memberships.find((row) => row.role === "owner" || row.role === "manager")
          ?.business ||
        actor.memberships[0]?.business ||
        "";
      if (!business || !can(actor, "customer.read", { business })) {
        return apiError("Your account does not manage wait requests.", 403, "forbidden");
      }
      const staff = await listBusinessBarbers(business);
      barberIds = staff.map((row) => row.id);
    }

    const groups = await Promise.all(barberIds.map((id) => waitsForBarber(id)));
    const seen = new Set<string>();
    const waits = groups
      .flat()
      .filter((wait) => {
        if (seen.has(wait.id)) return false;
        seen.add(wait.id);
        return true;
      })
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

    const barbers = await getBarbers(barberIds);
    return apiOk({
      business,
      waits,
      barbers: [...barbers.entries()].map(([id, row]) => ({ id, name: row.name })),
    });
  } catch (error) {
    console.error("[barber] waitlist read failed", error);
    return apiError("Could not load wait requests.", 502, "waits_failed");
  }
}
