import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  readJson,
  requireWorkspace,
  writeDenied,
} from "@/app/api/barber/_auth";
import { activeBusinessId, can, type Actor } from "@/lib/domain/access";
import { setPrefs } from "@/lib/domain/account";
import { audit } from "@/lib/domain/audit";
import { getBusiness, updateBusiness } from "@/lib/domain/business";
import { getBarber, updateBarber } from "@/lib/domain/professional";
import type { Business, NotificationPrefs } from "@/lib/domain/types";
import { apiError, apiOk } from "@/lib/http";

const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d\s()-]*$/, "Use digits and + ( ) - only.");
const link = z.string().trim().max(512);
const text = z.string().trim().max(512);

const profileSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().max(64).optional(),
  bio: text.optional(),
  photo: link.optional(),
  logo: link.optional(),
  active: z.boolean().optional(),
  shop: z.string().trim().max(64).optional(),
  address: z.string().trim().max(128).optional(),
  city: z.string().trim().max(64).optional(),
  years: z.number().int().min(0).max(80).optional(),
  skills: text.optional(),
  phone: phone.optional(),
  social: text.optional(),
  facilities: text.optional(),
  policy: text.optional(),
  cover: link.optional(),
  confirm: z.boolean().optional(),
  featured: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const prefsSchema = z.object({
  booking: z.boolean().optional(),
  reminder: z.boolean().optional(),
  waitlist: z.boolean().optional(),
  business: z.boolean().optional(),
  // Older hooks still send these names; keep accepting them for one release.
  newBookings: z.boolean().optional(),
  cancellations: z.boolean().optional(),
  reviews: z.boolean().optional(),
  reminders: z.boolean().optional(),
});

const patchSchema = z.object({
  profile: profileSchema.optional(),
  prefs: prefsSchema.optional(),
});

type PrefsPatch = z.infer<typeof prefsSchema>;

function mergedPrefs(current: NotificationPrefs, patch: PrefsPatch): NotificationPrefs {
  const next: NotificationPrefs = { ...current };
  if (typeof patch.booking === "boolean") next.booking = patch.booking;
  if (typeof patch.newBookings === "boolean") next.booking = patch.newBookings;
  if (typeof patch.cancellations === "boolean") next.booking = patch.cancellations;
  if (typeof patch.reminder === "boolean") next.reminder = patch.reminder;
  if (typeof patch.reminders === "boolean") next.reminder = patch.reminders;
  if (typeof patch.waitlist === "boolean") next.waitlist = patch.waitlist;
  if (typeof patch.business === "boolean") next.business = patch.business;
  if (typeof patch.reviews === "boolean") next.business = patch.reviews;
  return next;
}

/** Keep the old toggle names readable while the new categories are canonical. */
function prefsView(prefs: NotificationPrefs) {
  return {
    ...prefs,
    newBookings: prefs.booking,
    cancellations: prefs.booking,
    reviews: prefs.business,
    reminders: prefs.reminder,
  };
}

function businessPatch(input: z.infer<typeof profileSchema>): Partial<Business> {
  const patch: Partial<Business> = {};
  if (typeof input.name === "string") patch.name = input.name;
  if (typeof input.logo === "string") patch.logo = input.logo;
  if (typeof input.phone === "string") patch.phone = input.phone;
  if (typeof input.city === "string") patch.city = input.city;
  if (typeof input.address === "string") patch.address = input.address;
  if (typeof input.facilities === "string") patch.facilities = input.facilities;
  if (typeof input.policy === "string") patch.policy = input.policy;
  if (typeof input.cover === "string") patch.cover = input.cover;
  if (typeof input.confirm === "boolean") patch.confirm = input.confirm;
  if (typeof input.active === "boolean") patch.active = input.active;
  if (typeof input.lat === "number") patch.lat = input.lat;
  if (typeof input.lng === "number") patch.lng = input.lng;
  return patch;
}

type Target = {
  kind: "barber" | "business";
  id: string;
  chair: Awaited<ReturnType<typeof getBarber>> | Awaited<ReturnType<typeof getBusiness>>;
};

/**
 * `?scope=business` always resolves to the shop, even for an owner who also
 * has their own barber row. Without it the personal chair is edited.
 */
async function targetOf(
  actor: Actor,
  workspace: { barber: string; business: string },
  scope: string,
): Promise<Target | null> {
  if (scope === "business") {
    const id = activeBusinessId(actor) || workspace.business;
    if (!id || !can(actor, "settings.business", { business: id })) return null;
    return { kind: "business", id, chair: await getBusiness(id) };
  }
  if (workspace.barber) {
    return { kind: "barber", id: workspace.barber, chair: await getBarber(workspace.barber) };
  }
  if (workspace.business) {
    if (!can(actor, "settings.business", { business: workspace.business })) return null;
    return {
      kind: "business",
      id: workspace.business,
      chair: await getBusiness(workspace.business),
    };
  }
  return null;
}

/** GET /api/barber/settings?scope=business — professional/business profile. */
export async function GET(request: NextRequest) {
  const guarded = await requireWorkspace("settings.profile");
  if (!guarded.ok) return guarded.response;

  const { actor, workspace } = guarded;
  const scope = request.nextUrl.searchParams.get("scope") ?? "";
  try {
    const target = await targetOf(actor, workspace, scope);
    if (!target) return apiError("No workspace to edit.", 403, "no_workspace");
    return apiOk({
      barber: target.chair,
      chair: target.chair,
      scope: target.kind,
      prefs: prefsView(actor.profile.prefs),
    });
  } catch (error) {
    return businessFailure(error, "Could not load your settings.", "settings_failed");
  }
}

/** PATCH /api/barber/settings — save profile details or notification prefs. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireWorkspace("settings.profile");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(request, `barber:settings:${guarded.actor.userId}`, 60);
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = patchSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(
      firstIssue(parsed.error, "Check your settings."),
      400,
      "invalid_settings",
    );
  }
  if (!parsed.data.profile && !parsed.data.prefs) {
    return apiError("Nothing to update.", 400, "invalid_settings");
  }

  const { actor, workspace } = guarded;
  const scope = request.nextUrl.searchParams.get("scope") ?? "";
  try {
    const target = await targetOf(actor, workspace, scope);
    if (!target) return apiError("Set up your workspace first.", 403, "no_workspace");
    let chair = target.chair;

    if (parsed.data.profile) {
      chair =
        target.kind === "barber"
          ? await updateBarber(target.id, parsed.data.profile)
          : await updateBusiness(target.id, businessPatch(parsed.data.profile));
    }

    let prefs = actor.profile.prefs;
    if (parsed.data.prefs) {
      const profile = await setPrefs(
        actor.userId,
        mergedPrefs(actor.profile.prefs, parsed.data.prefs),
      );
      prefs = profile.prefs;
    }

    await audit({
      actor: actor.userId,
      action: "settings.change",
      kind: target.kind,
      target: target.id,
    });

    return apiOk({
      barber: chair,
      chair,
      scope: target.kind,
      prefs: prefsView(prefs),
    });
  } catch (error) {
    return businessFailure(error, "Could not save your settings.", "settings_failed");
  }
}
