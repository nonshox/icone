"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The whole site is the Telegram Mini App. When any page is opened from
 * Telegram, exchange Telegram's signed data for the HttpOnly session cookie
 * and stay on the same page.
 */
export function TelegramAutoSignIn() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData || cancelled) return;
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();

      try {
        const response = await fetch("/api/auth/telegram/mini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (response.ok && !cancelled) router.refresh();
      } catch {
        // Ordinary browser: nothing to do.
      }
    }

    if (window.Telegram?.WebApp) {
      void Promise.resolve().then(boot);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => void Promise.resolve().then(boot);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
