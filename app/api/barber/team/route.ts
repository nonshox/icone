import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { can, isOwner, type Actor } from "@/lib/domain/access";
import { requireUser } from "@/lib/api/guard";
import {
  createInvite,
  effectiveInviteState,
  listInvites,
  listMemberships,
  removeMember,
  setInviteState,
  updateMember,
} from "@/lib/domain/team";
import { notify } from "@/lib/domain/notify";
import { TEAM_ROLES } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin } from "@/lib/http";

const inviteSchema = z.object({
  business: z.string().trim().min(1).max(36).optional(),
  role: z.enum(TEAM_ROLES),
  to: z.string().trim().max(36).optional(),
  phone: z.string().trim().max(32).optional(),
  name: z.string().trim().max(64).optional(),
  branch: z.string().trim().max(36).optional(),
});

const memberSchema = z.object({
  id: z.string().trim().min(1).max(36),
  business: z.string().trim().min(1).max(36).optional(),
  role: z.enum(TEAM_ROLES).optional(),
  active: z.boolean().optional(),
  branch: z.string().trim().max(36).optional(),
  perms: z.record(z.string(), z.boolean()).optional(),
});

async function resolveBusiness(
  actor: Actor,
  requested?: string,
): Promise<string | null> {
  if (requested) {
    return can(actor, "team.read", { business: requested }) ||
      isOwner(actor, requested)
      ? requested
      : null;
  }
  return (
    actor.owns[0] ??
    actor.memberships.find((row) => row.role === "owner" || row.role === "manager")
      ?.business ??
    null
  );
}

/** GET /api/barber/team — members and invitations for the actor's business. */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;
  const business = await resolveBusiness(
    actor,
    request.nextUrl.searchParams.get("business") ?? undefined,
  );
  if (!business || !can(actor, "team.read", { business })) {
    return apiError("Your account does not manage a team.", 403, "forbidden");
  }

  try {
    const [members, invites] = await Promise.all([
      listMemberships(business),
      listInvites(business),
    ]);
    return apiOk({
      business,
      members,
      invites: invites.map((row) => ({
        ...row,
        state: effectiveInviteState(row),
      })),
    });
  } catch (error) {
    console.error("[api] team read failed", error);
    return apiError("Could not load the team.", 502, "team_failed");
  }
}

/** POST /api/barber/team — invite an employee by phone or account. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the invitation details.", 400, "invalid_invite");
  }

  const business = await resolveBusiness(actor, parsed.data.business);
  if (!business || !can(actor, "team.manage", { business })) {
    return apiError("You cannot invite team members.", 403, "forbidden");
  }
  if (parsed.data.role === "owner" && !isOwner(actor, business)) {
    return apiError("Only an owner can invite an owner.", 403, "forbidden");
  }

  try {
    const invite = await createInvite({
      business,
      role: parsed.data.role,
      to: parsed.data.to,
      phone: parsed.data.phone,
      name: parsed.data.name,
      branch: parsed.data.branch,
      by: actor.userId,
    });
    if (invite.to) {
      await notify({
        userId: invite.to,
        key: "invite",
        params: { business: business, role: invite.role },
        link: `/invite?token=${invite.token}`,
      }).catch((error) => console.error("[team] invite notice failed", error));
    }
    return NextResponse.json({ ok: true as const, invite }, { status: 201 });
  } catch (error) {
    console.error("[api] team invite failed", error);
    return apiError("Could not send the invitation.", 502, "invite_failed");
  }
}

/** PATCH /api/barber/team — change a member's role, branch or permissions. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Check the member details.", 400, "invalid_member");
  }
  const business = await resolveBusiness(actor, parsed.data.business);
  if (!business || !can(actor, "team.manage", { business })) {
    return apiError("You cannot manage this team.", 403, "forbidden");
  }
  if (
    parsed.data.role === "owner" &&
    !isOwner(actor, business)
  ) {
    return apiError("Only an owner can promote to owner.", 403, "forbidden");
  }

  try {
    // The membership id must belong to the business we just authorized; never
    // trust a client-supplied id to select a cross-tenant row.
    const existing = (await listMemberships(business)).find(
      (row) => row.id === parsed.data.id,
    );
    if (!existing) {
      return apiError("This member is not in your team.", 403, "forbidden");
    }
    const isSelf = existing.user === actor.userId;
    if (isSelf && (parsed.data.role || parsed.data.active !== undefined || parsed.data.perms)) {
      return apiError("You cannot change your own membership.", 403, "forbidden");
    }
    if (parsed.data.perms && !isOwner(actor, business)) {
      return apiError("Only an owner can change permissions.", 403, "forbidden");
    }
    const member = await updateMember(parsed.data.id, {
      role: parsed.data.role,
      active: parsed.data.active,
      branch: parsed.data.branch,
      perms: parsed.data.perms as Record<string, boolean> | undefined,
    });
    return apiOk({ member });
  } catch (error) {
    console.error("[api] team update failed", error);
    return apiError("Could not update the member.", 502, "member_failed");
  }
}

/** DELETE /api/barber/team — remove a member or revoke a pending invitation. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const actor = guarded.actor;

  const params = request.nextUrl.searchParams;
  const memberId = params.get("member") ?? "";
  const inviteId = params.get("invite") ?? "";
  if (!memberId && !inviteId) {
    return apiError("Pick a member or invitation.", 400, "no_id");
  }

  const business = await resolveBusiness(
    actor,
    params.get("business") ?? undefined,
  );
  if (!business || !can(actor, "team.manage", { business })) {
    return apiError("You cannot manage this team.", 403, "forbidden");
  }

  try {
    if (memberId) {
      const members = await listMemberships(business);
      if (!members.some((row) => row.id === memberId)) {
        return apiError("This member is not in your team.", 403, "forbidden");
      }
      if (
        members.find((row) => row.id === memberId)?.role === "owner" &&
        !isOwner(actor, business)
      ) {
        return apiError("Only an owner can remove an owner.", 403, "forbidden");
      }
      await removeMember(memberId);
    }
    if (inviteId) {
      const invites = await listInvites(business);
      if (!invites.some((row) => row.id === inviteId)) {
        return apiError("This invitation is not yours.", 403, "forbidden");
      }
      await setInviteState(inviteId, "revoked");
    }
    return apiOk();
  } catch (error) {
    console.error("[api] team delete failed", error);
    return apiError("Could not remove the entry.", 502, "team_failed");
  }
}
