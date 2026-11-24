"use client";

import { Send } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { T } from "@/components/i18n/t";
import { publicConfig } from "@/lib/public-config";

/**
 * One Telegram sign-in for both places. The website opens the bot with
 * `/start web`; the bot always sends a fresh one-time website link. Inside
 * Telegram the Mini App signs in automatically from Telegram's signed data.
 */
export function TelegramLogin({ className }: { className?: string }) {
  const bot = publicConfig.telegramBotUsername;

  return (
    <div className={className}>
      <a
        href={`https://t.me/${bot}?start=web`}
        target="_blank"
        rel="noreferrer noopener"
        className={`${buttonVariants({ size: "lg" })} h-11 w-full gap-2 text-sm`}
      >
        <Send className="size-4" aria-hidden />
        <T k="auth.telegramCta" />
      </a>
      <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
        <T k="auth.telegramHelp" />
      </p>
    </div>
  );
}
