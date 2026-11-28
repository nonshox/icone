import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  readJson,
  writeDenied,
} from "@/app/api/barber/_auth";
import { requireUser } from "@/lib/api/guard";
import { activeBusinessId, can, inBusiness, type Actor } from "@/lib/domain/access";
import {
  assignAllServices,
  assignService,
  getService,
  listEmployeeServices,
  servicesFor,
  setEmployeeService,
  unassignService,
  unassignedServices,
} from "@/lib/domain/catalog";
import { deactivateOffer, upsertOffer } from "@/lib/domain/offers";
import { getBarber } from "@/lib/domain/professional";
import { apiError, apiOk } from "@/lib/http";

const barberField = z.string().trim().min(1, "Pick an employee.").max(36);
const businessField = z.string().trim().max(36).optional();

const assignSchema = z
  .object({
    business: businessField,
    barber: barberField,
    all: z.boolean().optional(),
    service: z.string().trim().max(36).optional(),
    price: z.number().int().min(0).max(100_000_000).optional(),
    time: z.number().int().min(5).max(480).optional(),
  })
  .refine((value) => value.all === true || Boolean(value.service), {
    message: "Pick a service to assign.",
    path: ["service"],
  });

const patchSchema = z.object({
  business: businessField,
  barber: barberField,
  assignment: z.string().trim().min(1).max(36),
  active: z.boolean().optional(),
  /** -1 restores the catalogue value. */
  price: z.number().int().min(-1).max(100_000_000).optional(),
  time: z.number().int().min(-1).max(480).optional(),
});

const removeSchema = z.object({
  business: businessField,
  barber: barberField,
  assignment: z.string().trim().min(1).max(36),
});

type Target = { business: string; barber: string };

async function targetOf(
  actor: Actor,
  business?: string,
  barber?: string,
): Promise<Target | null> {
  const resolved =
    business || actor.barber?.business || activeBusinessId(actor);
  if (!resolved || !inBusiness(actor, resolved)) return null;

  if (barber) {
    const employee = await getBarber(barber);
    // Only shared-catalogue employees can be assigned services.
    if (!employee || employee.business !== resolved) return null;
  }
  return { business: resolved, barber: barber ?? "" };
}

/**
 * GET /api/barber/services/assign?barber=… — the services one employee can
 * perform together with the ones still missing from the shared catalogue.
 */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const params = request.nextUrl.searchParams;
  const target = await targetOf(
    guarded.actor,
    params.get("business") ?? undefined,
    params.get("barber") ?? undefined,
  );
  if (!target || !target.barber) {
    return apiError("Pick an employee in your business.", 400, "no_employee");
  }
  if (!can(guarded.actor, "service.read", { business: target.business })) {
    return apiError("You cannot see this employee's menu.", 403, "forbidden");
  }

  try {
    const [offered, overrides, unassigned] = await Promise.all([
      servicesFor(target.barber),
      listEmployeeServices(target.barber),
      unassignedServices(target.business, target.barber),
    ]);
    const byService = new Map(overrides.map((row) => [row.service, row]));

    return apiOk({
      business: target.business,
      barber: target.barber,
      assigned: offered.map((service) => {
        const override = byService.get(service.id);
        return {
          ...service,
          assignment: override?.id ?? "",
          overridePrice: override?.price ?? -1,
          overrideTime: override?.time ?? -1,
          active: override ? override.active : service.active,
        };
      }),
      unassigned,
    });
  } catch (error) {
    return businessFailure(error, "Could not load the employee menu.", "assign_failed");
  }
}

/** POST /api/barber/services/assign — assign one service or the whole catalogue. */
export async function POST(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(
    request,
    `barber:services:assign:${guarded.actor.userId}`,
    90,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = assignSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the assignment."),
      400,
      "invalid_assign",
    );
  }

  try {
    const target = await targetOf(
      guarded.actor,
      parsed.data.business,
      parsed.data.barber,
    );
    if (!target) {
      return apiError("That employee is not in your business.", 403, "forbidden");
    }
    if (!can(guarded.actor, "service.write", { business: target.business })) {
      return apiError("You cannot change this menu.", 403, "forbidden");
    }

    if (parsed.data.all) {
      // Only materialise the services that were actually missing: upserting
      // the whole catalogue would overwrite existing employee overrides.
      const missing = await unassignedServices(target.business, target.barber);
      // Offers are the authoritative assignment; empser is written afterwards
      // only as the legacy mirror.
      await Promise.all(
        missing.map((service) =>
          upsertOffer({
            business: target.business,
            barber: target.barber,
            service: service.id,
            price: service.price,
            time: service.time,
            active: true,
            sort: service.sort,
          }),
        ),
      );
      const count = await assignAllServices(target.business, target.barber);
      return apiOk({ count });
    }

    const service = await getService(parsed.data.service!);
    if (!service || service.business !== target.business) {
      return apiError("That service is not in your catalogue.", 404, "not_found");
    }
    // The offer is written first and resolves any inherited (-1) value to an
    // explicit one, so reads never depend on the legacy row being present.
    await upsertOffer({
      business: target.business,
      barber: target.barber,
      service: service.id,
      price: parsed.data.price,
      time: parsed.data.time,
      active: true,
      sort: service.sort,
    });
    // Legacy mirror for one release; the response stays the EmployeeService
    // shape callers already use.
    const assigned = await assignService({
      business: target.business,
      barber: target.barber,
      service: service.id,
      ...(typeof parsed.data.price === "number" ? { price: parsed.data.price } : {}),
      ...(typeof parsed.data.time === "number" ? { time: parsed.data.time } : {}),
    });
    return apiOk({ service: assigned });
  } catch (error) {
    return businessFailure(error, "Could not assign the service.", "assign_failed");
  }
}

/** PATCH /api/barber/services/assign — per-employee price, duration or state. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(
    request,
    `barber:services:assign:${guarded.actor.userId}`,
    90,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the override."),
      400,
      "invalid_assign",
    );
  }
  const { business, barber, assignment, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400, "invalid_assign");
  }

  try {
    const target = await targetOf(guarded.actor, business, barber);
    if (!target || !can(guarded.actor, "service.write", { business: target.business })) {
      return apiError("You cannot change this menu.", 403, "forbidden");
    }
    const owned = (await listEmployeeServices(target.barber)).find(
      (row) => row.id === assignment && row.business === target.business,
    );
    if (!owned) return apiError("That assignment no longer exists.", 404, "not_found");

    // Resolve inherited (-1) values against the catalogue *before* the legacy
    // row is touched, then write the offer first.
    const nextActive = patch.active ?? owned.active;
    if (!nextActive) {
      await deactivateOffer(target.barber, owned.service);
    } else {
      const service = await getService(owned.service);
      const inherit = (value: number, fallback: number) =>
        value >= 0 ? value : fallback;
      await upsertOffer({
        business: target.business,
        barber: target.barber,
        service: owned.service,
        price: inherit(patch.price ?? owned.price, service?.price ?? 0),
        time: inherit(patch.time ?? owned.time, service?.time ?? 30),
        active: true,
        sort: owned.sort,
      });
    }
    const updated = await setEmployeeService(assignment, patch);
    return apiOk({ service: updated });
  } catch (error) {
    return businessFailure(error, "Could not save the override.", "assign_failed");
  }
}

/** DELETE /api/barber/services/assign — unassign a shared service. */
export async function DELETE(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(
    request,
    `barber:services:assign:${guarded.actor.userId}`,
    90,
  );
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const body: Record<string, unknown> = {};
  const json = await readJson(request);
  if (json.ok && typeof json.value === "object" && json.value !== null) {
    Object.assign(body, json.value as Record<string, unknown>);
  }
  const parsed = removeSchema.safeParse({
    business: params.get("business") ?? body.business,
    barber: params.get("barber") ?? body.barber,
    assignment: params.get("assignment") ?? body.assignment,
  });
  if (!parsed.success) {
    return apiError("Pick an assignment to remove.", 400, "invalid_assign");
  }

  try {
    const target = await targetOf(
      guarded.actor,
      parsed.data.business,
      parsed.data.barber,
    );
    if (!target || !can(guarded.actor, "service.write", { business: target.business })) {
      return apiError("You cannot change this menu.", 403, "forbidden");
    }
    const owned = (await listEmployeeServices(target.barber)).find(
      (row) =>
        row.id === parsed.data.assignment && row.business === target.business,
    );
    if (!owned) return apiError("That assignment no longer exists.", 404, "not_found");

    await deactivateOffer(target.barber, owned.service);
    await unassignService(parsed.data.assignment);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not unassign the service.", "assign_failed");
  }
}
