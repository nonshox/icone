"use client";

import { Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TelegramLogin } from "@/components/auth/telegram-login";
import { SignInForm } from "@/components/auth/sign-in-form";
import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/lib/i18n/use-t";

/**
 * Two-click sign-in: Telegram is primary, email code is a secondary expandable
 * option. Inside the Telegram Mini App the session is created automatically.
 */
export function AuthOptions() {
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [auto, setAuto] = useState(false);
  const t = useT();
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

  if (mode === "email") {
    return (
      <div className="space-y-4">
        <SignInForm />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setMode("choose")}
        >
          ← {t("auth.telegramCta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TelegramLogin />

      <div className="flex items-center gap-3 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Separator className="flex-1" />
        <T k="auth.or" />
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-2 text-sm"
        onClick={() => setMode("email")}
      >
        <Mail className="size-4" aria-hidden />
        <T k="auth.emailOption" />
      </Button>
    </div>
  );
}
