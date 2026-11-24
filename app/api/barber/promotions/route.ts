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
  createPromotion,
  deletePromotion,
  listPromotions,
  updatePromotion,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";
import { isDate } from "@/lib/domain/time";

const date = z.union([z.literal(""), z.string().refine(isDate, "Use a YYYY-MM-DD date.")]);
const fields = {
  name: z.string().trim().min(1, "Give the offer a name.").max(64),
  kind: z.enum(["percent", "fixed"]),
  amount: z.number().int("Use a whole amount.").min(0),
  start: date,
  end: date,
  limit: z.number().int().min(0),
  note: z.string().trim().max(256),
  active: z.boolean(),
};

const createSchema = z.object(fields).superRefine((value, context) => {
  if (value.kind === "percent" && value.amount > 100) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "A percentage cannot exceed 100.",
    });
  }
  if (value.start && value.end && value.end < value.start) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "The end date must follow the start date.",
    });
  }
});
const patchSchema = z.object(fields).partial().extend({ id: idSchema });

/** GET /api/barber/promotions — own offers. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  try {
    return apiOk({ promotions: await listPromotions(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your offers.", "promotions_failed");
  }
}

/** POST /api/barber/promotions — add an offer. */
export async function POST(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the offer details."), 400, "invalid_promotion");
  }

  try {
    return apiOk({ promotion: await createPromotion(auth.userId, parsed.data) });
  } catch (error) {
    return businessFailure(error, "Could not add the offer.", "promotion_failed");
  }
}

/** PATCH /api/barber/promotions — edit your own offer. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the offer details."), 400, "invalid_promotion");
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400, "invalid_promotion");
  }

  try {
    return apiOk({ promotion: await updatePromotion(auth.userId, id, patch) });
  } catch (error) {
    return businessFailure(error, "Could not update the offer.", "promotion_failed");
  }
}

/** DELETE /api/barber/promotions?id=… — remove your own offer. */
export async function DELETE(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsed.success) {
    return apiError("Pick an offer to remove.", 400, "invalid_promotion");
  }

  try {
    await deletePromotion(auth.userId, parsed.data);
    return apiOk();
  } catch (error) {
    return businessFailure(error, "Could not remove the offer.", "promotion_failed");
  }
}
