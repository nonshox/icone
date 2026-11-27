import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import type { Actor } from "@/lib/domain/access";
import { list, str, type Row } from "@/lib/domain/crud";
import {
  conversationId,
  conversationsFor,
  counterpartNames,
  isParticipant,
  otherParty,
  send,
  thread,
  type Message,
} from "@/lib/domain/messages";
import {
  barberForUser,
  getBarber,
  getBarbers,
  isBookable,
} from "@/lib/domain/professional";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const sendSchema = z.object({
  to: z.string().trim().min(1).max(36),
  body: z.string().trim().min(1).max(1000),
});

/** People this actor may talk to. Admins may read any thread but never send. */
async function allowedPartners(actor: Actor): Promise<string[] | null> {
  if (actor.profile.role === "admin") return null;

  const mine = await list(TABLES.bookings, [
    Query.equal("user", actor.userId),
    Query.limit(100),
  ]);
  const chairIds = [...new Set(mine.map((row) => str(row.barber)))];
  if (actor.barber) chairIds.push(actor.barber.id);

  const onMyChair = actor.barber
    ? await list(TABLES.bookings, [
        Query.equal("barber", actor.barber.id),
        Query.limit(100),
      ])
    : [];
  const customers = onMyChair.map((row) => str(row.user)).filter(Boolean);

  const chairs = await getBarbers(chairIds);
  const staff = [...chairs.values()].map((barber) => barber.user).filter(Boolean);

  return [...new Set([...staff, ...customers])].filter(
    (id) => id && id !== actor.userId,
  );
}

/** A deep link may carry either an account id or the id of a chair. */
async function resolveTarget(id: string, allowed: string[] | null): Promise<string> {
  if (allowed?.includes(id) || allowed === null) return id;
  const barber = await getBarber(id).catch(() => null);
  if (barber?.user) {
    // Booking-derived partners and active public chairs both resolve to the
    // account that actually receives the message.
    if (allowed.includes(barber.user) || isBookable(barber)) return barber.user;
  }
  return id;
}

/**
 * A public profile is a second, booking-independent way to start a thread:
 * any signed-in member may write to an active professional. Historical
 * booking-derived partners stay authorized even if a chair later goes quiet.
 */
async function publicBarber(userId: string): Promise<string | null> {
  const barber = await barberForUser(userId).catch(() => null);
  return barber && isBookable(barber) && barber.user === userId
    ? barber.user
    : null;
}

async function mayMessage(
  actor: Actor,
  allowed: string[] | null,
  target: string,
): Promise<boolean> {
  if (target === actor.userId || actor.profile.role === "admin") return false;
  if (allowed?.includes(target)) return true;
  return (await publicBarber(target).catch(() => null)) !== null;
}

function toMessage(row: Row): Message {
  return {
    id: row.$id,
    conversation: str(row.conversation),
    sender: str(row.sender),
    body: str(row.body),
    created: row.$createdAt,
  };
}

/**
 * GET /api/messages — the caller's threads.
 * GET /api/messages?with=<userId> — one thread and its history.
 */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const params = request.nextUrl.searchParams;
  const requestedWith = params.get("with");
  const requestedConversation = params.get("conversation");

  try {
    const allowed = await allowedPartners(actor);

    if (requestedWith || requestedConversation) {
      if (
        requestedWith &&
        (requestedWith.length > 36 || requestedWith === actor.userId)
      ) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }
      if (requestedConversation && requestedConversation.length > 160) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }

      const other = requestedWith
        ? await resolveTarget(requestedWith, allowed)
        : requestedConversation
          ? otherParty(requestedConversation, actor.userId)
          : null;
      const conversation =
        requestedConversation ??
        (other ? conversationId(actor.userId, other) : "");

      if (!other || other === actor.userId || !conversation) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }
      // An existing thread stays readable; a brand-new one needs either a
      // booking-derived partner or an active professional's public profile.
      if (
        actor.profile.role !== "admin" &&
        !isParticipant(conversation, actor.userId) &&
        !(await mayMessage(actor, allowed, other))
      ) {
        return apiError(
          "You cannot open a conversation with this member.",
          403,
          "forbidden",
        );
      }

      // Admins are not participants in every thread, so they read by
      // conversation id instead of filtering through the participant check.
      const messages =
        actor.profile.role === "admin"
          ? (await list(TABLES.messages, [
              Query.equal("conversation", conversation),
              Query.orderAsc("$createdAt"),
              Query.limit(100),
            ])).map(toMessage)
          : await thread(conversation, actor.userId);

      const names = await counterpartNames([other]);
      return apiOk({
        with: other,
        conversation,
        participant: { id: other, name: names.get(other) || "Member" },
        messages,
      });
    }

    const threads = await conversationsFor(actor.userId, new Map());
    let visibleIds: string[] | null = null;
    if (allowed) {
      const fromProfiles = new Set<string>();
      for (const row of threads) {
        if (allowed.includes(row.with)) continue;
        if (await publicBarber(row.with)) fromProfiles.add(row.with);
      }
      visibleIds = [...new Set([...allowed, ...fromProfiles])];
    }

    const names = await counterpartNames(visibleIds ?? threads.map((row) => row.with));
    const ids = visibleIds;
    const visible = ids
      ? threads.filter((row) => ids.includes(row.with))
      : threads;

    // Keep the original DTO keys while carrying the richer domain fields.
    return apiOk({
      threads: visible.map((row) => ({
        ...row,
        id: row.with,
        name: names.get(row.with) || row.withName || "Member",
        preview: row.last,
        at: row.lastAt,
        conversation: row.id,
      })),
    });
  } catch (error) {
    console.error("[api] messages read failed", error);
    return apiError("Could not load messages.", 502, "messages_failed");
  }
}

/** POST /api/messages — send a message to an allowed counterpart. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError(
      "This request came from an unexpected origin.",
      403,
      "bad_origin",
    );
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const limit = rateLimit(`message:${actor.userId}`, 40, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Write a message and try again.", 400, "bad_message");
  }

  try {
    const allowed = await allowedPartners(actor);
    const to = await resolveTarget(parsed.data.to, allowed);

    if (!(await mayMessage(actor, allowed, to))) {
      return apiError(
        "You cannot message this member.",
        403,
        "forbidden",
      );
    }

    const message = await send({
      conversation: conversationId(actor.userId, to),
      sender: actor.userId,
      body: parsed.data.body,
    });
    if (!message) {
      return apiError("Could not send the message.", 400, "bad_message");
    }

    return NextResponse.json(
      { ok: true as const, message },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api] message send failed", error);
    return apiError("Could not send the message.", 502, "message_failed");
  }
}
