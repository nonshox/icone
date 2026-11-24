import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import { isValidSecret, sendMessage } from "@/lib/telegram/webhook";

type Update = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
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
 * Telegram delivers updates here. The secret token is checked on every call;
 * nothing else is trusted. Replies are best-effort and never block the 200 —
 * Telegram retries non-2xx responses, which would duplicate updates.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (!isValidSecret(request.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_WEBHOOK_SECRET)) {
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
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Welcome to icone. Open the Mini App to sign in and book a chair.",
        `${env.NEXT_PUBLIC_APP_URL}/mini`,
      );
    } catch (error) {
      console.error(
        "[telegram] reply failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return NextResponse.json({ ok: true });
}
