"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TelegramLogin } from "@/components/auth/telegram-login";
import { T } from "@/components/i18n/t";

/** Telegram-only sign-in. Inside the Mini App it needs zero clicks. */
export function AuthOptions() {
  const [auto, setAuto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;

    void Promise.resolve().then(async () => {
      setAuto(true);
      try {
        const response = await fetch("/api/auth/telegram/mini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) {
          router.push("/start");
          router.refresh();
        } else {
          setAuto(false);
        }
      } catch {
        setAuto(false);
      }
    });
  }, [router]);

  if (auto) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="size-5 animate-spin text-brand-strong" aria-hidden />
        <p className="text-sm text-muted-foreground"><T k="auth.signingIn" /></p>
      </div>
    );
  }

  return <TelegramLogin />;
}
