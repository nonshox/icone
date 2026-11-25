import "server-only";

import { AppwriteException, Users } from "node-appwrite";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/appwrite/server";
import {
  linkTelegramPhone,
  markPhoneRequest,
  pendingNonceForChat,
  sendCode,
} from "@/lib/auth/phone";
import { createWebLoginTicket } from "@/lib/auth/web-login";
import { ensureProfile, updateProfile } from "@/lib/domain/data";
import { serverEnv } from "@/lib/env";
import { isValidSecret, sendMessage } from "@/lib/telegram/webhook";

type Update = {
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string; username?: string };
    text?: string;
    contact?: { phone_number?: string };
  };
};

const ok = () => NextResponse.json({ ok: true });

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

const shareKeyboard = {
  keyboard: [[{ text: "Share phone", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

/**
 * POST /api/telegram/webhook
 * Telegram-only auth. The bot asks for a phone with one tap and sends the
 * 4-digit code to the same chat. The code is entered where it was requested.
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
  const name = update.message?.from?.first_name?.trim() || "Telegram member";

  try {
    // One-tap phone share from the website or the app.
    if (update.message?.contact?.phone_number) {
      const phone = update.message.contact.phone_number.replace(/[^\d]/g, "").slice(0, 15);
      const nonce = await pendingNonceForChat(chatId);
      if (nonce && phone) {
        await linkTelegramPhone(nonce, chatId, phone);
      } else if (phone) {
        const userId = `tg_${chatId}`;
        await ensureUser(userId, name);
        await ensureProfile({ $id: userId, name });
        await updateProfile(userId, { phone });
      }
      await sendMessage(token, chatId, "Enter the code where you started.", {
        remove_keyboard: true,
      });
      return ok();
    }

    if (text?.startsWith("/start phone_")) {
      const nonce = text.slice("/start phone_".length).trim();
      if (nonce) {
        await markPhoneRequest(chatId, nonce);
        await sendMessage(token, chatId, "Tap to share your phone.", shareKeyboard);
      }
      return ok();
    }

    if (text?.startsWith("/start otp_")) {
      const [nonce, phone] = text.slice("/start otp_".length).split("_");
      const delivered = nonce && phone ? await sendCode(nonce, chatId) : false;
      await sendMessage(
        token,
        chatId,
        delivered ? "Enter the code where you started." : "Request expired. Start again.",
      );
      return ok();
    }

    if (text?.startsWith("/start")) {
      const userId = `tg_${chatId}`;
      await ensureUser(userId, name);
      const profile = await ensureProfile({ $id: userId, name });
      const link = await createWebLoginTicket(userId);
      await sendMessage(
        token,
        chatId,
        "Open icone. This link works once, for five minutes.",
        { inline_keyboard: [[{ text: "Open icone", url: link }]] },
      );
      if (!profile.phone) {
        await sendMessage(token, chatId, "Tap to share your phone.", shareKeyboard);
      }
    }
  } catch (error) {
    console.error(
      "[telegram] webhook failed",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return ok();
}
