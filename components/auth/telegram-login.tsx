"use client";

import { Send } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { publicConfig } from "@/lib/public-config";

/**
 * Telegram sign-in without the Login Widget. The widget asks for extra phone
 * permissions and needs a registered domain; the Mini App verifies Telegram's
 * own signature on the server and reuses the same create-or-login logic.
 */
export function TelegramLogin({ className }: { className?: string }) {
  const bot = publicConfig.telegramBotUsername;

  return (
    <div className={className}>
      <a
        href={`https://t.me/${bot}?start=signin`}
        target="_blank"
        rel="noreferrer noopener"
        className={`${buttonVariants({ size: "lg" })} h-11 w-full gap-2 text-sm`}
      >
        <Send className="size-4" aria-hidden />
        Continue in Telegram
      </a>
      <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
        Open the bot, then tap “Open icone”. We&apos;ll sign you in or create
        your account — no phone, no password.
      </p>
    </div>
  );
}
