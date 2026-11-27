import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/api/guard";
import { getSettings, updateSettings } from "@/lib/domain/admin";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * The product has no inbox broadcast feature. The sign-in notice is the one
 * platform-wide message that exists, so these endpoints read and write it.
 */
const writeSchema = z.union([
  z.object({ notice: z.string().trim().max(512) }).strict(),
  z
    .object({
      title: z.string().trim().min(1, "Give the notice a title.").max(96),
      body: z.string().trim().min(1, "Write a message.").max(512),
      audience: z.enum(["all", "client", "barber", "admin"]).optional(),
    })
    .strict(),
]);

type PlatformNotice = {
  id: string;
  title: string;
  body: string;
  audience: "all";
  created: string;
};

/** One synthetic row so the existing list-shaped client can render the setting. */
function notices(notice: string): PlatformNotice[] {
  return notice
    ? [
        {
          id: "platform-notice",
          title: "Notice",
          body: notice,
          audience: "all",
          created: "",
        },
      ]
    : [];
}

/** GET /api/admin/announcements — the current platform notice. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const settings = await getSettings();
    return apiOk({
      announcements: notices(settings.notice),
      notice: settings.notice,
    });
  } catch (error) {
    console.error("[admin] notice read failed", error);
    return apiError("Could not load the notice.", 502, "announcements_failed");
  }
}

async function write(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(
    `admin:announcements:${guard.actor.userId}`,
    20,
    10 * 60_000,
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Check the notice.",
      400,
      "invalid_announcement",
    );
  }

  if (
    "audience" in parsed.data &&
    parsed.data.audience &&
    parsed.data.audience !== "all"
  ) {
    return apiError(
      "The platform notice is shown to everyone.",
      400,
      "unsupported_audience",
    );
  }

  const notice =
    "notice" in parsed.data
      ? parsed.data.notice
      : `${parsed.data.title}: ${parsed.data.body}`;

  try {
    const settings = await updateSettings({ notice }, guard.actor.userId);
    // There are no inbox broadcasts to count, so nothing is sent.
    return NextResponse.json({
      ok: true as const,
      notice: settings.notice,
      announcements: notices(settings.notice),
      sent: 0,
    });
  } catch (error) {
    console.error("[admin] notice update failed", error);
    return apiError("Could not save the notice.", 502, "announcement_failed");
  }
}

/** POST/PATCH /api/admin/announcements — update the platform notice. */
export async function POST(request: NextRequest) {
  return write(request);
}

export async function PATCH(request: NextRequest) {
  return write(request);
}
