import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getProfile } from "@/lib/domain/account";
import { createBarber, ensureBarber, updateBarber } from "@/lib/domain/professional";
import { notify } from "@/lib/domain/notify";
import {
  addMember,
  effectiveInviteState,
  inviteByToken,
  invitationsFor,
  setInviteState,
} from "@/lib/domain/team";

/** GET /api/invites — pending invitations for this account. */
export async function GET() {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  try {
    const profile = await getProfile(guarded.actor.userId);
    const invites = await invitationsFor({
      id: guarded.actor.userId,
      phone: profile?.phone ?? "",
    });
    return apiOk({
      invites: invites.map((row) => ({
        ...row,
        state: effectiveInviteState(row),
      })),
    });
  } catch (error) {
    console.error("[api] invites failed", error);
    return apiError("Could not load invitations.", 502, "invites_failed");
  }
}

const acceptSchema = z.object({
  token: z.string().trim().min(8).max(64),
});

/** POST /api/invites — accept an invitation and join the team. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;
  const limit = rateLimit(`invite:${guarded.actor.userId}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("This invitation link is not valid.", 400, "bad_invite");
  }

  try {
    const invite = await inviteByToken(parsed.data.token);
    if (!invite || effectiveInviteState(invite) !== "pending") {
      return apiError("This invitation is no longer available.", 404, "invite_gone");
    }
    const profile = await getProfile(guarded.actor.userId);
    if (
      invite.to &&
      invite.to !== guarded.actor.userId &&
      !(profile?.phone && invite.phone === profile.phone)
    ) {
      return apiError("This invitation is not for your account.", 403, "forbidden");
    }

    const seed = {
      name: profile?.name || invite.name || "Barber",
      phone: profile?.phone || invite.phone || "",
      business: invite.business,
      branch: invite.branch,
      state: "active" as const,
      active: true,
    };
    let barber = await ensureBarber(guarded.actor.userId, seed);
    if (barber.business && barber.business !== invite.business) {
      // One professional row belongs to one business. An existing row for a
      // different shop must not be silently re-pointed; give this team its own.
      barber = await createBarber({ ...seed, user: guarded.actor.userId });
    } else if (!barber.business) {
      barber = await updateBarber(barber.id, {
        business: invite.business,
        branch: invite.branch,
        state: "active",
        active: true,
      });
    }

    const member = await addMember({
      business: invite.business,
      user: guarded.actor.userId,
      role: invite.role,
      barber: barber.id,
      branch: invite.branch,
      state: "active",
    });
    await setInviteState(invite.id, "accepted");

    if (invite.by) {
      await notify({
        userId: invite.by,
        key: "team.joined",
        params: { name: profile?.name ?? "A team member" },
        link: "/barber/team",
      }).catch((error) => console.error("[invite] notice failed", error));
    }

    return NextResponse.json({ ok: true as const, member }, { status: 201 });
  } catch (error) {
    console.error("[api] invite accept failed", error);
    return apiError("Could not accept the invitation.", 502, "invite_failed");
  }
}

/** DELETE /api/invites?id=... — decline an invitation. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return apiError("Pick an invitation.", 400, "no_id");

  try {
    const profile = await getProfile(guarded.actor.userId);
    const mine = await invitationsFor({
      id: guarded.actor.userId,
      phone: profile?.phone ?? "",
    });
    if (!mine.some((row) => row.id === id)) {
      return apiError("This invitation is not yours.", 403, "forbidden");
    }
    await setInviteState(id, "declined");
    return apiOk();
  } catch (error) {
    console.error("[api] invite decline failed", error);
    return apiError("Could not decline the invitation.", 502, "invite_failed");
  }
}
