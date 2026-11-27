import "server-only";

import { AppwriteException, Users } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/appwrite/server";
import { normalizePhone } from "@/lib/auth/phone";
import { verifyWebAppInitData } from "@/lib/auth/telegram";
import { ensureProfile, updateProfile } from "@/lib/domain/account";
import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin, tooManyRequests } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  initData: z.string().min(1).max(16_384),
  phone: z.string().trim().min(7).max(32),
});

/** POST /api/auth/telegram/phone — one-tap contact share inside the app. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError("This request came from an unexpected origin.", 403, "bad_origin");
  }

  const limit = rateLimit(`telegram:phone:${clientIp(request)}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400, "invalid_body");
  }

  const parsed = schema.safeParse(body);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) {
    return apiError("Invalid phone number.", 400, "bad_phone");
  }

  const telegram = parsed.success
    ? verifyWebAppInitData(parsed.data.initData, serverEnv().TELEGRAM_BOT_TOKEN)
    : null;
  if (!telegram) return apiError("Telegram could not verify this.", 401, "bad_signature");

  try {
    const users = new Users(createAdminClient());
    const userId = `tg_${telegram.id}`;
    try {
      await users.get({ userId });
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 404) throw error;
      await users.create({ userId, name: telegram.firstName });
    }

    await ensureProfile({ $id: userId, name: telegram.firstName });
    await updateProfile(userId, { phone });
    await users.updatePrefs({
      userId,
      prefs: {
        ...(await users.get({ userId })).prefs,
        phone,
        telegramId: telegram.id,
      },
    });
    return NextResponse.json({ ok: true as const });
  } catch (error) {
    console.error("[auth] telegram phone share failed", error);
    return apiError("Could not save your phone. Try again.", 502, "phone_failed");
  }
}
