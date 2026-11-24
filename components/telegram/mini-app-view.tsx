"use client";

import { ArrowLeft, CalendarDays, Check, ExternalLink, Scissors } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

export function MiniAppView() {
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [webLoginUrl, setWebLoginUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const webapp = window.Telegram?.WebApp;

      if (!webapp || !webapp.initData) {
        if (cancelled) return;
        setStatus("error");
        setMessage("Open this page from the icone bot in Telegram.");
        return;
      }

      webapp.ready();
      webapp.expand();

      try {
        const response = await fetch("/api/auth/telegram/mini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: webapp.initData }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          user?: { name?: string };
          webLoginUrl?: string | null;
          error?: { message?: string };
        } | null;

        if (cancelled) return;

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error?.message ?? "Telegram sign-in did not complete.",
          );
        }

        setName(
          data.user?.name ??
            webapp.initDataUnsafe.user?.first_name ??
            "there",
        );
        setWebLoginUrl(data.webLoginUrl ?? "");
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "Sign-in did not complete.",
        );
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
    script.onerror = () => {
      if (cancelled) return;
      setStatus("error");
      setMessage("Could not load Telegram. Check your connection.");
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Telegram sign-in</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <a
            href="https://t.me/icone_app_bot"
            className={cn(buttonVariants({ size: "sm" }), "w-full rounded-lg")}
          >
            Open the bot
          </a>
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full rounded-lg",
            )}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Sign in with email
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="size-4" aria-hidden />
          Signed in as {name}
        </CardTitle>
        <CardDescription>
          Your account carries over from Telegram. No password needed. Use the
          one-time link below to stay signed in on the website too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href="/book"
          className={cn(buttonVariants({ size: "sm" }), "w-full rounded-lg")}
        >
          <Scissors className="size-3.5" aria-hidden />
          Book a chair
        </Link>
        <Link
          href="/bookings"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full rounded-lg",
          )}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          My visits
        </Link>
        {webLoginUrl ? (
          <Button
            type="button"
            size="sm"
            className="w-full rounded-lg"
            onClick={() => {
              const webapp = window.Telegram?.WebApp;
              if (webapp?.openLink) {
                webapp.openLink(webLoginUrl);
              } else {
                window.open(webLoginUrl, "_blank", "noopener");
              }
            }}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open in website
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full rounded-lg"
          onClick={() => window.Telegram?.WebApp?.close()}
        >
          Close
        </Button>
      </CardContent>
    </Card>
  );
}
