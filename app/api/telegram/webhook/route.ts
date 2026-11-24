import "server-only";

import { AppwriteException, Users } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/appwrite/server";
import { sendCode } from "@/lib/auth/phone";
import { createWebLoginTicket } from "@/lib/auth/web-login";
import { ensureProfile, updateProfile } from "@/lib/domain/data";
import { serverEnv } from "@/lib/env";
import { isValidSecret, sendMessage } from "@/lib/telegram/webhook";

type Update = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string; username?: string };
    text?: string;
    contact?: { phone_number?: string };
  };
};

const ok = () => NextResponse.json({ ok: true });

/** Health check — useful after a deploy, before Telegram sends anything. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}

async function ensureUser(userId: string, name: string): Promise<void> {
  const users = new Users(createAdminClient());
  try {
    await users.get({ userId });
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 404) throw error;
    await users.create({ userId, name });
  }
}

/**
 * POST /api/telegram/webhook
 *
 * One Telegram-only auth flow. Every web sign-in click starts with `/start`,
 * which always issues a fresh one-time website ticket — clearing the chat can
 * never lock a member out. The Mini App signs in with the same `tg_<id>` identity.
 * A phone number, when shared, comes from Telegram and is never verified by SMS.
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
    return ok();
  }

  const chatId = update.message?.chat?.id;
  if (!chatId) return ok();

  const token = env.TELEGRAM_BOT_TOKEN;
  const text = update.message?.text?.trim();

  // OTP codes are delivered to the chat that opened the web form's bot link.
  if (text?.startsWith("/start otp_")) {
    try {
      const [nonce, phone] = text.slice("/start otp_".length).split("_");
      const delivered = nonce && phone ? await sendCode(phone, nonce, chatId) : false;
      await sendMessage(
        token,
        chatId,
        delivered
          ? "Enter the code where you started. It expires in 5 minutes."
          : "That request expired. Start again in the app.",
      );
    } catch (error) {
      console.error("[telegram] otp delivery failed", error instanceof Error ? error.message : "unknown");
    }
    return ok();
  }

  const name = update.message?.from?.first_name?.trim() || "Telegram member";
  const userId = `tg_${chatId}`;

  try {
    const contact = update.message?.contact?.phone_number;
    if (contact) {
      const phone = contact.replace(/[^\d+]/g, "").slice(0, 32);
      if (phone) {
        await ensureUser(userId, name);
        await ensureProfile({ $id: userId, name });
        await updateProfile(userId, { phone });
        await sendMessage(token, chatId, "Phone saved.", {
          remove_keyboard: true,
        });
      }
      return ok();
    }

    if (update.message?.text?.startsWith("/start")) {
      await ensureUser(userId, name);
      const profile = await ensureProfile({ $id: userId, name });
      const link = await createWebLoginTicket(userId);

      await sendMessage(
        token,
        chatId,
        "Sign in on the website and the installed app. This link works once, for five minutes.",
        { inline_keyboard: [[{ text: "Open icone", url: link }]] },
      );

      // Optional: a phone number saves time at booking. Never required for auth.
      if (!profile.phone) {
        await sendMessage(
          token,
          chatId,
          "Want your number saved for bookings? Optional.",
          {
            keyboard: [[{ text: "Share phone", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        );
      }
    }
  } catch (error) {
    console.error(
      "[telegram] reply failed",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return ok();
}
