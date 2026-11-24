import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with a booking, an account or a visit at icone.",
};

const channels = [
  {
    title: "Telegram",
    body: `Send /start to @${publicConfig.telegramBotUsername} and describe what you need.`,
    action: "Open the bot",
    href: `https://t.me/${publicConfig.telegramBotUsername}?start=web`,
  },
  {
    title: "Email",
    body: "For written records, account and privacy requests.",
    action: "hello@icone.uz",
    href: "mailto:hello@icone.uz",
  },
];

const fixes = [
  {
    title: "The sign-in code never arrived",
    body: "Check spam, then request a new code. Codes expire after ten minutes.",
  },
  {
    title: "A slot vanished at checkout",
    body: "Someone reserved it first. Pick another time from the barber profile.",
  },
  {
    title: "I need to change a visit",
    body: "Cancel it under My visits, then book the new time.",
  },
  {
    title: "I did not get a reminder",
    body: "Link Telegram and turn on Visit reminders in Settings.",
  },
  {
    title: "A review will not post",
    body: "Reviews open once the visit is marked completed, one per booking.",
  },
];

export default function SupportPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Support
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Tell us what happened.
          </h1>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.title} size="sm" className="h-full">
              <CardHeader>
                <CardTitle>{channel.title}</CardTitle>
                <CardDescription>{channel.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={channel.href}
                  target={channel.href.startsWith("http") ? "_blank" : undefined}
                  rel={channel.href.startsWith("http") ? "noreferrer noopener" : undefined}
                  className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
                >
                  {channel.action}
                </a>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Quick fixes</h2>
          <Card>
            <CardContent className="divide-y divide-border/60">
              {fixes.map((item) => (
                <div key={item.title} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Related reading</CardTitle>
              <CardDescription>More answers.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link
                href="/help"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                Help centre
              </Link>
              <Link
                href="/bookings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                My visits
              </Link>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Response times</CardTitle>
              <CardDescription>
                Telegram within a few hours on business days. Email about a day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Mention same-day visits in your first message.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
