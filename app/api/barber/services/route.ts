import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  idSchema,
  readJson,
  requireWorkspace,
  writeDenied,
  type Workspace,
} from "@/app/api/barber/_auth";
import type { Actor } from "@/lib/domain/access";
import {
  createService,
  getService,
  listBarberServices,
  listBusinessServices,
  retireService,
  servicesFor,
  updateService,
} from "@/lib/domain/catalog";
import type { Service } from "@/lib/domain/types";
import { apiError, apiOk } from "@/lib/http";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the service a name.").max(64),
  note: z.string().trim().max(256).default(""),
  price: z.number().int("Price must be whole UZS.").min(0),
  time: z
    .number()
    .int("Duration must be whole minutes.")
    .min(5, "Allow at least 5 minutes.")
    .max(240, "Duration cannot exceed 4 hours."),
  buffer: z.number().int().min(0).max(120).default(0),
  image: z.string().trim().max(512).default(""),
  category: z.string().trim().min(1).max(32).default("Hair"),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});
const patchSchema = createSchema.partial().extend({ id: idSchema });

function owns(service: Service, workspace: Workspace): boolean {
  return Boolean(
    (workspace.barber && service.barber === workspace.barber) ||
      (workspace.business && service.business === workspace.business),
  );
}

/** Owners manage the shared catalogue; a barber manages their own menu. */
function managed(actor: Actor, workspace: Workspace): Workspace {
  const business = workspace.business || actor.owns[0] || "";
  return actor.owns.length > 0 || !workspace.barber
    ? { barber: "", business }
    : { barber: workspace.barber, business: "" };
}

/**
 * GET /api/barber/services — the menu this account manages. A barber edits
 * their own rows; an owner or manager edits the shared shop catalogue.
 */
export async function GET() {
  const guarded = await requireWorkspace("service.read");
  if (!guarded.ok) return guarded.response;

  const target = managed(guarded.actor, guarded.workspace);
  try {
    if (target.barber) {
      const own = await listBarberServices(target.barber, true);
      return apiOk({
        services: own.length > 0 ? own : await servicesFor(target.barber),
      });
    }
    if (target.business) {
      return apiOk({ services: await listBusinessServices(target.business, true) });
    }
    return apiOk({ services: [] });
  } catch (error) {
    return businessFailure(error, "Could not load your services.", "services_failed");
  }
}

/** POST /api/barber/services — add a service to the managed menu. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("service.write");
  if (!guarded.ok) return guarded.response;

  const denied = writeDenied(request, `barber:services:${guarded.actor.userId}`, 90);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the service details."),
      400,
      "invalid_service",
    );
  }

  const target = managed(guarded.actor, guarded.workspace);
  if (!target.barber && !target.business) {
    return apiError("Set up your workspace first.", 403, "no_workspace");
  }

  try {
    const input = {
      name: parsed.data.name,
      note: parsed.data.note,
      price: parsed.data.price,
      time: parsed.data.time,
      buffer: parsed.data.buffer,
      category: parsed.data.category,
      ...(target.barber ? { barber: target.barber } : { business: target.business }),
    };
    let service = await createService(input);
    if (parsed.data.image || parsed.data.featured || !parsed.data.active) {
      service = await updateService(service.id, {
        ...(parsed.data.image ? { image: parsed.data.image } : {}),
        ...(parsed.data.featured ? { featured: true } : {}),
        ...(!parsed.data.active ? { active: false } : {}),
      });
    }
    return apiOk({ service });
  } catch (error) {
    return businessFailure(error, "Could not add the service.", "service_failed");
  }
}

/** PATCH /api/barber/services — edit any field of your own service. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireWorkspace("service.write");
  if (!guarded.ok) return guarded.response;

  const denied = writeDenied(request, `barber:services:${guarded.actor.userId}`, 90);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check the service details."),
      400,
      "invalid_service",
    );
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400, "invalid_service");
  }

  try {
    const existing = await getService(id);
    if (!existing || !owns(existing, guarded.workspace)) {
      return apiError("That service is not yours.", 404, "not_found");
    }
    return apiOk({ service: await updateService(id, patch) });
  } catch (error) {
    return businessFailure(error, "Could not update the service.", "service_failed");
  }
}

/**
 * DELETE /api/barber/services?id=… — retire a service. History depends on the
 * row, so it is deactivated instead of removed.
 */
export async function DELETE(request: NextRequest) {
  const guarded = await requireWorkspace("service.write");
  if (!guarded.ok) return guarded.response;

  const denied = writeDenied(request, `barber:services:${guarded.actor.userId}`, 90);
  if (denied) return denied;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsed.success) {
    return apiError("Pick a service to remove.", 400, "invalid_service");
  }

  try {
    const existing = await getService(parsed.data);
    if (!existing || !owns(existing, guarded.workspace)) {
      return apiError("That service is not yours.", 404, "not_found");
    }
    await retireService(parsed.data);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the service.", "service_failed");
  }
}
