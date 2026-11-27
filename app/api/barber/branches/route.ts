import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { can, inBusiness } from "@/lib/domain/access";
import { requireUser } from "@/lib/api/guard";
import {
  closeBranch,
  createBranch,
  listBranches,
  makePrimary,
  updateBranch,
} from "@/lib/domain/business";
import { apiError, apiOk, isSameOrigin } from "@/lib/http";

const createSchema = z.object({
  business: z.string().trim().min(1).max(36).optional(),
  name: z.string().trim().min(1).max(64),
  city: z.string().trim().max(64).optional(),
  primary: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().trim().min(1).max(36),
  business: z.string().trim().min(1).max(36).optional(),
  name: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
  city: z.string().trim().max(64).optional(),
  district: z.string().trim().max(64).optional(),
  address: z.string().trim().max(160).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  note: z.string().trim().max(256).optional(),
  active: z.boolean().optional(),
  primary: z.boolean().optional(),
});

async function businessOf(actor: Awaited<ReturnType<typeof requireUser>>, requested?: string) {
  if (!actor.ok) return null;
  const business =
    requested ?? actor.actor.owns[0] ?? actor.actor.memberships[0]?.business ?? "";
  return business && inBusiness(actor.actor, business) ? business : null;
}

export async function GET(request: NextRequest) {
  const actor = await requireUser();
  if (!actor.ok) return actor.response;
  const business = await businessOf(
    actor,
    request.nextUrl.searchParams.get("business") ?? undefined,
  );
  if (!business || !can(actor.actor, "branch.read", { business })) {
    return apiError("Your account does not manage branches.", 403, "forbidden");
  }

  try {
    return apiOk({ branches: await listBranches(business) });
  } catch (error) {
    console.error("[api] branches failed", error);
    return apiError("Could not load branches.", 502, "branches_failed");
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const actor = await requireUser();
  if (!actor.ok) return actor.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the branch details.", 400, "invalid_branch");
  }
  const business = await businessOf(actor, parsed.data.business);
  if (!business || !can(actor.actor, "branch.manage", { business })) {
    return apiError("You cannot manage branches.", 403, "forbidden");
  }

  try {
    const branch = await createBranch({
      business,
      name: parsed.data.name,
      city: parsed.data.city,
      primary: parsed.data.primary,
    });
    return NextResponse.json({ ok: true as const, branch }, { status: 201 });
  } catch (error) {
    console.error("[api] branch create failed", error);
    return apiError("Could not create the branch.", 502, "branch_failed");
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const actor = await requireUser();
  if (!actor.ok) return actor.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the branch details.", 400, "invalid_branch");
  }
  const business = await businessOf(actor, parsed.data.business);
  if (!business || !can(actor.actor, "branch.manage", { business })) {
    return apiError("You cannot manage branches.", 403, "forbidden");
  }

  const { id, business: ignoredBusiness, ...patch } = parsed.data;
  void ignoredBusiness;
  try {
    const branches = await listBranches(business);
    if (!branches.some((row) => row.id === id)) {
      return apiError("This branch is not in your business.", 403, "forbidden");
    }
    const branch = await updateBranch(id, patch);
    if (patch.primary) await makePrimary(business, id);
    return apiOk({ branch });
  } catch (error) {
    console.error("[api] branch update failed", error);
    return apiError("Could not update the branch.", 502, "branch_failed");
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const actor = await requireUser();
  if (!actor.ok) return actor.response;

  const params = request.nextUrl.searchParams;
  const business = await businessOf(
    actor,
    params.get("business") ?? undefined,
  );
  if (!business || !can(actor.actor, "branch.manage", { business })) {
    return apiError("You cannot manage branches.", 403, "forbidden");
  }
  const id = params.get("id") ?? "";
  if (!id) return apiError("Pick a branch.", 400, "no_id");

  try {
    const branches = await listBranches(business);
    const target = branches.find((row) => row.id === id);
    if (!target) return apiError("This branch is not in your business.", 403, "forbidden");
    if (branches.length === 1) {
      return apiError("A business needs at least one branch.", 409, "last_branch");
    }
    await closeBranch(id);
    return apiOk();
  } catch (error) {
    console.error("[api] branch close failed", error);
    return apiError("Could not close the branch.", 502, "branch_failed");
  }
}
