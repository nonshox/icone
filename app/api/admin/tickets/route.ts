import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { closeTicket, listTickets, replyTicket } from "@/lib/domain/admin";
import type { Ticket } from "@/lib/domain/types";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const stateSchema = z.enum(["open", "answered", "closed"]);

const querySchema = z.object({
  state: stateSchema.optional(),
});

const patchSchema = z
  .object({
    id: z.string().trim().min(1, "Pick a request.").max(36),
    action: z.enum(["reply", "close"]),
    reply: z.string().trim().min(1).max(1024).optional(),
  })
  .refine((value) => value.action !== "reply" || Boolean(value.reply), {
    message: "Write a reply first.",
    path: ["reply"],
  });

/** GET /api/admin/tickets?state= — the support inbox. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse({
    state: request.nextUrl.searchParams.get("state") || undefined,
  });
  if (!parsed.success) {
    return apiError("Check the ticket filter.", 400, "invalid_filter");
  }

  try {
    const tickets: Ticket[] = await listTickets(parsed.data.state);
    return apiOk({ tickets });
  } catch (error) {
    console.error("[admin] tickets list failed", error);
    return apiError("Could not load requests.", 502, "tickets_failed");
  }
}

/** PATCH /api/admin/tickets — answer or close a support request. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`admin:tickets:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the request.",
      400,
      "invalid_ticket",
    );
  }

  try {
    const { id, action, reply } = parsed.data;
    if (action === "reply") {
      await replyTicket(id, reply!, guard.actor.userId);
    } else {
      await closeTicket(id, guard.actor.userId);
    }
    return apiOk();
  } catch (error) {
    console.error("[admin] ticket update failed", error);
    return apiError("Could not update the request.", 502, "ticket_failed");
  }
}
