import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  canMessage,
  conversationId,
  createMessage,
  createNotification,
  getThread,
  getThreadByConversation,
  listThreads,
  type Actor,
} from "@/lib/domain/messages";
import { currentMember } from "@/lib/domain/member";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const sendSchema = z.object({
  to: z.string().trim().min(1).max(36),
  body: z.string().trim().min(1).max(1000),
});

/**
 * GET /api/messages — the caller's threads.
 * GET /api/messages?with=<userId> — one thread and its history.
 */
export async function GET(request: NextRequest) {
  const member = await currentMember();
  if (!member) return apiError("Sign in to see your messages.", 401, "signed_out");

  const actor: Actor = { id: member.user.id, role: member.profile.role };
  const params = request.nextUrl.searchParams;
  const other = params.get("with");
  const conversation = params.get("conversation");

  try {
    if (other || conversation) {
      if (other && (other.length > 36 || other === actor.id)) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }

      if (conversation && conversation.length > 80) {
        return apiError("That conversation is not available.", 403, "forbidden");
      }

      let thread: Awaited<ReturnType<typeof getThread>> | null = null;

      if (actor.role === "admin") {
        thread = conversation
          ? await getThreadByConversation(conversation, actor.id)
          : other
            ? await getThread(actor, other)
            : null;
      } else if (
        other &&
        (!conversation ||
          conversation === conversationId(actor.id, other)) &&
        (await canMessage(actor, other))
      ) {
        thread = await getThread(actor, other);
      }

      if (!thread) {
        return apiError(
          "You can only message a barber from one of your bookings.",
          403,
          "forbidden",
        );
      }

      return NextResponse.json({
        ok: true as const,
        with: other,
        conversation,
        participant: thread.participant,
        messages: thread.messages,
      });
    }

    return NextResponse.json({
      ok: true as const,
      threads: await listThreads(actor),
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

  const member = await currentMember();
  if (!member) return apiError("Sign in to send a message.", 401, "signed_out");

  const limit = rateLimit(`message:${member.user.id}`, 40, 60 * 60_000);
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

  const { to, body: text } = parsed.data;
  const actor: Actor = { id: member.user.id, role: member.profile.role };

  if (to === actor.id) {
    return apiError("You cannot message yourself.", 400, "bad_recipient");
  }

  if (actor.role === "admin" || !(await canMessage(actor, to))) {
    return apiError(
      "You can only message a barber from one of your bookings.",
      403,
      "forbidden",
    );
  }

  try {
    const message = await createMessage({
      conversation: conversationId(actor.id, to),
      sender: actor.id,
      body: text,
    });

    // The inbox row is best effort: a notification failure must not hide a
    // message that was already delivered to the thread.
    await createNotification({
      user: to,
      title: "New message",
      body: `${member.profile.name || "Member"}: ${text.slice(0, 180)}`,
      kind: "message",
    }).catch((error) => {
      console.error("[api] message notification failed", error);
    });

    return NextResponse.json(
      { ok: true as const, message },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api] message send failed", error);
    return apiError("Could not send the message.", 502, "message_failed");
  }
}
