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
  createPortfolio,
  deletePortfolio,
  listPortfolio,
  updatePortfolio,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";

const fields = {
  url: z.string().trim().min(1, "Add an image link.").max(512),
  note: z.string().trim().max(128),
};
const createSchema = z.object(fields);
const patchSchema = z.object(fields).partial().extend({ id: idSchema });

/** GET /api/barber/portfolio — own photos. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    return apiOk({ items: await listPortfolio(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your portfolio.", "portfolio_failed");
  }
}

/** POST /api/barber/portfolio — add a photo. */
export async function POST(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the photo."), 400, "invalid_photo");
  }

  try {
    return apiOk({ item: await createPortfolio(auth.userId, parsed.data) });
  } catch (error) {
    return businessFailure(error, "Could not add the photo.", "photo_failed");
  }
}

/** PATCH /api/barber/portfolio — edit your own photo. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the photo."), 400, "invalid_photo");
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400, "invalid_photo");
  }

  try {
    return apiOk({ item: await updatePortfolio(auth.userId, id, patch) });
  } catch (error) {
    return businessFailure(error, "Could not update the photo.", "photo_failed");
  }
}

/** DELETE /api/barber/portfolio?id=… — remove your own photo. */
export async function DELETE(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsed.success) {
    return apiError("Pick a photo to remove.", 400, "invalid_photo");
  }

  try {
    await deletePortfolio(auth.userId, parsed.data);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the photo.", "photo_failed");
  }
}
