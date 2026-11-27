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
import { getBarber, getBarbers } from "@/lib/domain/professional";
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
  return barber?.user && (allowed?.includes(barber.user) ?? true) ? barber.user : id;
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
      if (
        actor.profile.role !== "admin" &&
        (!isParticipant(conversation, actor.userId) ||
          !allowed?.includes(other))
      ) {
        return apiError(
          "You can only message a barber from one of your bookings.",
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

    const names = await counterpartNames(allowed ?? []);
    const threads = await conversationsFor(actor.userId, names);
    const visible = allowed ? threads.filter((row) => allowed.includes(row.with)) : threads;

    // Keep the original DTO keys while carrying the richer domain fields.
    return apiOk({
      threads: visible.map((row) => ({
        ...row,
        id: row.with,
        name: row.withName || "Member",
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

    if (actor.profile.role === "admin" || to === actor.userId || !allowed?.includes(to)) {
      return apiError(
        "You can only message a barber from one of your bookings.",
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
