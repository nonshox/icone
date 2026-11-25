"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";

/**
 * The whole site is the Telegram Mini App. Any page opened from Telegram signs
 * in from signed data; if the phone is missing, one tap shares it.
 */
export function TelegramAutoSignIn() {
  const router = useRouter();
  const [needPhone, setNeedPhone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const webapp = window.Telegram?.WebApp;
      const initData = webapp?.initData;
      if (!initData || cancelled) return;
      webapp?.ready();
      webapp?.expand();

      try {
        const response = await fetch("/api/auth/telegram/mini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (!response.ok || cancelled) return;

        const me = await fetch("/api/me").catch(() => null);
        const data = (await me?.json().catch(() => null)) as {
          profile?: { phone?: string };
        } | null;
        if (!data?.profile?.phone && !cancelled) setNeedPhone(true);
        router.refresh();
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

  async function sharePhone() {
    const webapp = window.Telegram?.WebApp;
    if (!webapp?.requestContact || !webapp.initData) return;
    setBusy(true);
    webapp.requestContact(async (contact) => {
      const phone = contact?.phone_number;
      if (phone) {
        try {
          const response = await fetch("/api/auth/telegram/phone", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ initData: webapp.initData, phone }),
          });
          if (response.ok) {
            setNeedPhone(false);
            router.refresh();
          }
        } catch {
          // Keep the prompt visible for a retry.
        }
      }
      setBusy(false);
    });
  }

  if (!needPhone) return null;

  return (
    <div className="glass fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl p-4 text-center sm:inset-x-5">
      <p className="text-sm text-muted-foreground"><T k="auth.phonePrompt" /></p>
      <Button
        type="button"
        size="sm"
        className="mt-3 h-10 w-full rounded-xl"
        disabled={busy || !window.Telegram?.WebApp?.requestContact}
        onClick={() => void sharePhone()}
      >
        <T k="auth.sharePhone" />
      </Button>
    </div>
  );
}
