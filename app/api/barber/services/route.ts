import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  barberAuth,
  businessFailure,
  firstIssue,
  idSchema,
  readJson,
} from "@/app/api/barber/_auth";
import {
  createBusinessService,
  deleteBusinessService,
  listBusinessServices,
  updateBusinessService,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";

const fields = {
  name: z.string().trim().min(1, "Give the service a name.").max(64),
  note: z.string().trim().max(256),
  price: z.number().int("Price must be whole UZS.").min(0),
  time: z
    .number()
    .int("Duration must be whole minutes.")
    .min(5, "Allow at least 5 minutes.")
    .max(240, "Duration cannot exceed 4 hours."),
  image: z.string().trim().max(512),
  category: z.string().trim().min(1).max(32),
  featured: z.boolean(),
  discount: z.number().int().min(0).max(100),
  active: z.boolean(),
};

const createSchema = z.object(fields);
const patchSchema = z.object(fields).partial().extend({ id: idSchema });

/** GET /api/barber/services — own menu, active and inactive. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    return apiOk({ services: await listBusinessServices(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your services.", "services_failed");
  }
}

/** POST /api/barber/services — add a service to your own menu. */
export async function POST(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the service details."), 400, "invalid_service");
  }

  try {
    return apiOk({ service: await createBusinessService(auth.userId, parsed.data) });
  } catch (error) {
    return businessFailure(error, "Could not add the service.", "service_failed");
  }
}

/** PATCH /api/barber/services — edit any field of your own service. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the service details."), 400, "invalid_service");
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400, "invalid_service");
  }

  try {
    return apiOk({ service: await updateBusinessService(auth.userId, id, patch) });
  } catch (error) {
    return businessFailure(error, "Could not update the service.", "service_failed");
  }
}

/** DELETE /api/barber/services?id=… — remove your own service. */
export async function DELETE(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsed.success) {
    return apiError("Pick a service to remove.", 400, "invalid_service");
  }

  try {
    await deleteBusinessService(auth.userId, parsed.data);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the service.", "service_failed");
  }
}
