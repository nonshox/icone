"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { publicConfig } from "@/lib/public-config";

type TelegramLoginProps = {
  className?: string;
};

/**
 * Telegram Login Widget. The widget redirects the browser to our callback with
 * signed user data, so no client-side token handling is needed.
 *
 * Requires the site domain to be linked to the bot via @BotFather /setdomain.
 * On hosts that are not registered (localhost, preview URLs) set
 * NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED=false to show the fallback below instead
 * of Telegram's "Bot domain invalid" frame.
 */
export function TelegramLogin({ className }: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const botUsername = publicConfig.telegramBotUsername;
  const enabled = publicConfig.telegramLoginEnabled;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container || !botUsername) return;

    container.replaceChildren();

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute(
      "data-auth-url",
      `${window.location.origin}/api/auth/telegram/callback`,
    );
    script.addEventListener("error", () => {
      setError("Telegram could not load. Check your connection and try again.");
    });

    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [botUsername, enabled]);

  if (!botUsername) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Telegram sign-in is not configured yet.
      </p>
    );
  }

  if (!enabled) {
    return (
      <div className={className}>
        <a
          href={`https://t.me/${botUsername}?start=signin`}
          target="_blank"
          rel="noreferrer noopener"
          className="glass-soft flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          <Send className="size-4 text-brand-strong" aria-hidden />
          Continue in Telegram
        </a>
        <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          Open the bot, then tap “Open icone” to sign in with Telegram.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="flex min-h-10 items-center justify-center"
      />
      {error ? (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      ) : (
        <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          We&apos;ll create your account from Telegram. No password needed.
        </p>
      )}
    </div>
  );
}
