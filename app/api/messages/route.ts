import "server-only";

import { Query } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import type { Actor } from "@/lib/domain/access";
import { list, str } from "@/lib/domain/crud";
import {
  appendMessage,
  conversationForPair,
  getOrCreateConversation,
  isParticipant,
  listConversations,
  markRead,
  messagesFor,
  otherParty,
  pairKey,
  unreadFor,
  type ConversationRecord,
} from "@/lib/domain/conversations";
import {
  counterpartNames,
  otherParty as otherPartyFromPair,
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

/**
 * GET /api/messages — the caller's threads.
 * GET /api/messages?with=<userId> — one thread and its history.
 * GET /api/messages?conversation=<pair> — the same by stable pair key.
 *
 * Opening a thread clears the caller's unread counter for that pair.
 */
export async function GET(request: NextRequest) {
  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const actor = guarded.actor;
  const admin = actor.profile.role === "admin";
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

      let record: ConversationRecord | null = null;
      let other = "";
      let pair = "";

      if (requestedWith) {
        other = await resolveTarget(requestedWith, allowed);
        pair = pairKey(actor.userId, other);
        record = await conversationForPair(pair);

        if (!admin) {
          // An existing thread stays readable only to its participants. A new
          // one needs a booking-derived partner or an active public profile.
          if (record) {
            if (!isParticipant(record, actor.userId)) {
              return apiError("That conversation is not available.", 403, "forbidden");
            }
          } else if (!(await mayMessage(actor, allowed, other))) {
            return apiError(
              "You cannot open a conversation with this member.",
              403,
              "forbidden",
            );
          }
          record = record ?? (await getOrCreateConversation(actor.userId, other));
        }
      } else if (requestedConversation) {
        pair = requestedConversation;
        record = await conversationForPair(pair);
        other = record
          ? otherParty(record, actor.userId) ?? ""
          : otherPartyFromPair(pair, actor.userId) ?? "";

        if (!admin) {
          if (record) {
            if (!isParticipant(record, actor.userId)) {
              return apiError("That conversation is not available.", 403, "forbidden");
            }
          } else {
            // A thread written before the conversation table existed: the
            // legacy pair must still resolve to this account before it can be
            // adopted as a conversation row.
            const canonical = other ? pairKey(actor.userId, other) : "";
            if (canonical !== pair || !(await mayMessage(actor, allowed, other))) {
              return apiError("That conversation is not available.", 403, "forbidden");
            }
            record = await getOrCreateConversation(actor.userId, other);
          }
        }
      }

      if (!pair || !other || other === actor.userId) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }

      if (!admin && record) {
        await markRead(record, actor.userId);
      }
      const unread = !admin && record ? 0 : record ? unreadFor(record, actor.userId) : 0;

      // Admins read by conversation id rather than through the participant
      // check; they are never a party to a member-to-member thread.
      const messages =
        record && (admin ? true : isParticipant(record, actor.userId))
          ? await messagesFor(record, admin ? null : actor.userId)
          : await messagesFor(pair, null);

      const names = await counterpartNames([other]);
      return apiOk({
        with: other,
        conversation: pair,
        participant: { id: other, name: names.get(other) || "Member" },
        messages,
        unread,
      });
    }

    const records = await listConversations(actor.userId);
    const pairs = [
      ...new Set(
        records.map((row) => otherParty(row, actor.userId)).filter(Boolean),
      ),
    ] as string[];

    let visible = records;
    if (allowed) {
      const permitted = new Set(allowed);
      const fromProfiles = new Set<string>();
      await Promise.all(
        pairs.map(async (id) => {
          if (!permitted.has(id) && (await publicBarber(id))) fromProfiles.add(id);
        }),
      );
      const ids = new Set([...permitted, ...fromProfiles]);
      visible = records.filter((row) =>
        ids.has(otherParty(row, actor.userId) ?? ""),
      );
    }

    const names = await counterpartNames(pairs);
    // Keep the original DTO keys while carrying the richer domain fields.
    return apiOk({
      threads: visible.map((row) => {
        const withId = otherParty(row, actor.userId) ?? "";
        return {
          id: withId,
          with: withId,
          withName: names.get(withId) ?? "",
          withAvatar: "",
          name: names.get(withId) || withId || "Member",
          last: row.last,
          preview: row.last,
          lastAt: row.lastAt,
          at: row.lastAt,
          unread: unreadFor(row, actor.userId),
          conversation: row.pair,
        };
      }),
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
  const limit = await rateLimit(`message:${actor.userId}`, 40, 60 * 60_000);
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

    const conversation = await getOrCreateConversation(actor.userId, to);
    if (!conversation) {
      return apiError("Could not open the conversation.", 400, "bad_message");
    }

    const message = await appendMessage({
      conversation,
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
