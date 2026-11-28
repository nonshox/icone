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
  type WorkspaceGuarded,
} from "@/app/api/barber/_auth";
import {
  addPortfolioItem,
  allPortfolio,
  deletePortfolioItem,
  updatePortfolioItem,
} from "@/lib/domain/portfolio";
import { apiError, apiOk } from "@/lib/http";

const fields = {
  url: z.string().trim().min(1, "Add an image link.").max(512),
  note: z.string().trim().max(128),
  group: z.string().trim().max(64),
  featured: z.boolean(),
  public: z.boolean(),
};
const createSchema = z.object({
  url: fields.url,
  note: fields.note.default(""),
  group: fields.group.default(""),
  featured: fields.featured.default(false),
  public: fields.public.default(true),
});
const patchSchema = z.object(fields).partial().extend({ id: idSchema });

function owned(g: WorkspaceGuarded): string | null {
  return g.ok ? g.workspace.barber : null;
}

/** GET /api/barber/portfolio — own photos, hidden ones included. */
export async function GET() {
  const guarded = await requireWorkspace("settings.profile");
  if (!guarded.ok) return guarded.response;

  const barber = owned(guarded);
  if (!barber) return apiOk({ items: [] });

  try {
    return apiOk({ items: await allPortfolio(barber) });
  } catch (error) {
    return businessFailure(error, "Could not load your portfolio.", "portfolio_failed");
  }
}

/** POST /api/barber/portfolio — add a photo. */
export async function POST(request: NextRequest) {
  const guarded = await requireWorkspace("portfolio.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `barber:portfolio:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the photo."), 400, "invalid_photo");
  }

  const barber = owned(guarded);
  if (!barber) {
    return apiError(
      "Your account is not linked to a professional profile.",
      403,
      "no_chair",
    );
  }

  try {
    let item = await addPortfolioItem({
      barber,
      url: parsed.data.url,
      note: parsed.data.note,
      group: parsed.data.group,
      featured: parsed.data.featured,
    });
    if (!parsed.data.public) {
      item = await updatePortfolioItem(item.id, { public: false });
    }
    return apiOk({ item });
  } catch (error) {
    return businessFailure(error, "Could not add the photo.", "photo_failed");
  }
}

/** PATCH /api/barber/portfolio — edit your own photo. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireWorkspace("portfolio.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `barber:portfolio:${guarded.actor.userId}`, 60);
  if (denied) return denied;

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

  const barber = owned(guarded);
  if (!barber) {
    return apiError(
      "Your account is not linked to a professional profile.",
      403,
      "no_chair",
    );
  }

  try {
    const mine = await allPortfolio(barber);
    if (!mine.some((item) => item.id === id)) {
      return apiError("That photo is not yours.", 404, "not_found");
    }
    return apiOk({ item: await updatePortfolioItem(id, patch) });
  } catch (error) {
    return businessFailure(error, "Could not update the photo.", "photo_failed");
  }
}

/** DELETE /api/barber/portfolio?id=… — remove your own photo. */
export async function DELETE(request: NextRequest) {
  const guarded = await requireWorkspace("portfolio.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `barber:portfolio:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsed.success) {
    return apiError("Pick a photo to remove.", 400, "invalid_photo");
  }

  const barber = owned(guarded);
  if (!barber) {
    return apiError(
      "Your account is not linked to a professional profile.",
      403,
      "no_chair",
    );
  }

  try {
    const mine = await allPortfolio(barber);
    if (!mine.some((item) => item.id === parsed.data)) {
      return apiError("That photo is not yours.", 404, "not_found");
    }
    await deletePortfolioItem(parsed.data);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the photo.", "photo_failed");
  }
}
