import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { TABLES } from "@/lib/appwrite/db";
import { listUsers, setUserState } from "@/lib/domain/admin";
import { audit } from "@/lib/domain/audit";
import { list, update } from "@/lib/domain/crud";
import { getBarber } from "@/lib/domain/professional";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const userId = z.string().trim().min(1, "Pick a member.").max(36);

/** One operation per request: role, chair link, or account status. */
const patchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    return {
      ...(value as Record<string, unknown>),
      op: "role" in value ? "role" : "barber" in value ? "barber" : "status",
    };
  },
  z.discriminatedUnion("op", [
    z
      .object({
        op: z.literal("role"),
        userId,
        role: z.enum(["client", "barber", "admin"]),
      })
      .strict(),
    z.object({ op: z.literal("barber"), userId, barber: z.string().trim().max(36) }).strict(),
    z.object({ op: z.literal("status"), userId, active: z.boolean() }).strict(),
  ]),
);

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/** GET /api/admin/users — accounts with their role and state. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const parsed = z
    .object({
      q: z.string().trim().max(64).optional(),
      state: z.string().trim().max(24).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .safeParse({
      q: params.get("q") ?? undefined,
      state: params.get("state") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
  if (!parsed.success) {
    return apiError("Check the member filters.", 400, "invalid_filter");
  }

  try {
    const users = await listUsers(parsed.data);
    return apiOk({
      users: users.map((user) => ({
        ...user,
        // Kept for the older table that reads `status` as a boolean.
        status: user.state === "active",
      })),
    });
  } catch (error) {
    console.error("[admin] users list failed", error);
    return apiError("Could not load members.", 502, "users_failed");
  }
}

/** PATCH /api/admin/users — change a role, chair link or account state. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = await rateLimit(`admin:users:${guard.actor.userId}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the member details."), 400, "invalid_user");
  }

  try {
    const data = parsed.data;

    if (data.op === "role") {
      await update(TABLES.users, data.userId, { role: data.role });
      await audit({
        actor: guard.actor.userId,
        action: "role.change",
        kind: "user",
        target: data.userId,
        detail: data.role,
      });
    } else if (data.op === "barber") {
      if (data.barber && !(await getBarber(data.barber))) {
        return apiError("That chair does not exist.", 404, "no_barber");
      }
      await update(TABLES.barbers, data.barber, { user: data.userId });
      if (data.userId) {
        const previous = await list(TABLES.barbers, [
          Query.equal("user", data.userId),
          Query.limit(50),
        ]);
        await Promise.all(
          previous
            .filter((row) => row.$id !== data.barber)
            .map((row) => update(TABLES.barbers, row.$id, { user: "" })),
        );
      }
      await audit({
        actor: guard.actor.userId,
        action: "role.change",
        kind: "user",
        target: data.userId,
        detail: `chair:${data.barber || "none"}`,
      });
    } else {
      if (data.userId === guard.actor.userId) {
        return apiError("You cannot change your own account status.", 400, "self_status");
      }
      // setUserState also suspends or restores every chair the account holds.
      await setUserState(
        data.userId,
        data.active ? "active" : "suspended",
        guard.actor.userId,
      );
    }

    return apiOk();
  } catch (error) {
    console.error("[admin] user update failed", error);
    return apiError("Could not update the member.", 502, "user_failed");
  }
}
