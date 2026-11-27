import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import {
  applicationFor,
  decideApplication,
  saveDraft,
  submitApplication,
} from "@/lib/domain/application";
import { getSettings } from "@/lib/domain/admin";
import type { Application } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  model: z.enum(["a", "b"]).default("a"),
  name: z.string().trim().min(1, "Add your name.").max(64),
  shop: z.string().trim().max(64).default(""),
  city: z.string().trim().max(64).default(""),
  address: z.string().trim().max(128).default(""),
  phone: z.string().trim().max(32).regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.").default(""),
  bio: z.string().trim().max(512).default(""),
});

/**
 * A draft is saved mid-flow, so any field may still be empty. The field names
 * and formats match `schema`; only the "name is required" rule is relaxed.
 */
const draftSchema = z.object({
  model: z.enum(["a", "b"]).optional(),
  name: z.string().trim().max(64).optional(),
  shop: z.string().trim().max(64).optional(),
  city: z.string().trim().max(64).optional(),
  address: z.string().trim().max(128).optional(),
  phone: z.string().trim().max(32).regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.").optional(),
  bio: z.string().trim().max(512).optional(),
});

/**
 * The customer form only knows three labels. The canonical state travels in
 * `appState` so the review queue and the applicant cannot disagree.
 */
function visibleApplication(application: Application) {
  const state =
    application.state === "approved"
      ? "approved"
      : application.state === "rejected" || application.state === "suspended"
        ? "rejected"
        : "pending";

  return {
    ...application,
    state,
    appState: application.state,
    note: application.note || application.reason,
  };
}

/** GET /api/applications — the caller's application status. */
export async function GET() {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  try {
    const application = await applicationFor(guarded.actor.userId);
    return apiOk({ application: application ? visibleApplication(application) : null });
  } catch (error) {
    console.error("[applications] read failed — check the applications collection in db:setup", error);
    return apiError(
      "Applications are unavailable right now. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}

/**
 * PATCH /api/applications — save progress without submitting.
 *
 * Returns the same visible shape as GET so the form can resume where it left
 * off. This never moves the row into the review queue.
 */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  if (guarded.actor.profile.role !== "client") {
    return apiError("Only client accounts can apply.", 403, "forbidden");
  }

  const limit = rateLimit(`application-drafts:${guarded.actor.userId}`, 30, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check your details.",
      400,
      "invalid_application",
    );
  }

  try {
    const application = await saveDraft(guarded.actor.userId, parsed.data);
    return apiOk({ application: visibleApplication(application) });
  } catch (error) {
    console.error("[applications] draft save failed — check the applications collection in db:setup", error);
    return apiError(
      "Could not save your draft. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}

/** POST /api/applications — save the form and enter the review queue. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  if (guarded.actor.profile.role !== "client") {
    return apiError("Only client accounts can apply.", 403, "forbidden");
  }

  const limit = rateLimit(`applications:${guarded.actor.userId}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check your details.",
      400,
      "invalid_application",
    );
  }

  try {
    const settings = await getSettings();
    if (!settings.applicationsOpen) {
      return apiError(
        "Applications are temporarily closed. Try again later.",
        403,
        "applications_closed",
      );
    }

    const userId = guarded.actor.userId;
    await saveDraft(userId, parsed.data);
    let application = await submitApplication(userId);
    if (settings.autoVerify) {
      const decision = await decideApplication({
        id: application.id,
        decision: "approve",
        by: userId,
        note: "Automatic verification is enabled.",
      });
      if (decision.ok) application = decision.application;
    }
    return apiOk({ application: visibleApplication(application) });
  } catch (error) {
    console.error("[applications] submit failed — check the applications collection in db:setup", error);
    return apiError(
      "Could not send your application. Please try again shortly.",
      502,
      "applications_failed",
    );
  }
}
