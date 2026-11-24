import "server-only";

import { AppwriteException, Users } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/appwrite/server";
import { createWebLoginTicket } from "@/lib/auth/web-login";
import { serverEnv } from "@/lib/env";
import { isValidSecret, sendMessage } from "@/lib/telegram/webhook";

type Update = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
};

/** Health check — useful after a deploy, before Telegram sends anything. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}

/**
 * POST /api/telegram/webhook
 *
 * Secret-checked Telegram updates. `/start` is answered once with a one-time
 * website sign-in link. Repeated starts get a short hint instead of another
 * button, so the chat does not fill up.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (
    !isValidSecret(
      request.headers.get("x-telegram-bot-api-secret-token"),
      env.TELEGRAM_WEBHOOK_SECRET,
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();

  if (chatId && text?.startsWith("/start")) {
    try {
      const client = createAdminClient();
      const users = new Users(client);
      const userId = `tg_${chatId}`;

      let greeted = false;
      try {
        const existing = await users.get({ userId });
        greeted = (existing.prefs as Record<string, unknown>).botGreeted === true;
      } catch (error) {
        if (!(error instanceof AppwriteException) || error.code !== 404) {
          throw error;
        }
        await users.create({
          userId,
          name: update.message?.from?.first_name || "Telegram member",
        });
      }

      if (greeted) {
        await sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Open icone from the menu button, or sign in on the website.",
        );
      } else {
        const link = await createWebLoginTicket(userId);
        const fresh = await users.get({ userId });
        await users.updatePrefs({
          userId,
          prefs: { ...fresh.prefs, botGreeted: true },
        });
        await sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `Welcome to icone. One-time website sign-in link (5 min): ${link}\n\nThis signs you into the website and the installed app, not just Telegram.`,
        );
      }
    } catch (error) {
      console.error(
        "[telegram] reply failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return NextResponse.json({ ok: true });
}
