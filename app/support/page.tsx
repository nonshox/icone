import Link from "next/link";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/lib/domain/access";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";

export const metadata = routeMetadata({
  path: "/support",
  titleKey: "support.title",
  descriptionKey: "meta.support.description",
});

const channels = [
  {
    id: "telegram",
    href: `https://t.me/${publicConfig.telegramBotUsername}?start=web`,
    external: true,
  },
  { id: "email", href: "mailto:hello@icone.uz", external: false },
] as const;

const fixes = [1, 2, 3, 4, 5] as const;

/** The ticket form needs an account; guests get a sign-in CTA and stay in touch
 * through the public Telegram contact below. */
async function ContactSupport() {
  const actor = await getActor();
  if (!actor) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle><T k="support.signIn.title" /></CardTitle>
          <CardDescription><T k="support.signIn.body" /></CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/sign-in?next=${encodeURIComponent("/support")}`}
            className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
          >
            <T k="support.signIn.action" />
          </Link>
        </CardContent>
      </Card>
    );
  }
  return <SupportTicketForm />;
}

export default function SupportPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="support.eyebrow" />
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            <T k="support.title" />
          </h1>
        </div>

        <section id="contact-support" className="mt-8">
          <Suspense
            fallback={
              <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            }
          >
            <ContactSupport />
          </Suspense>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.id} size="sm" className="h-full">
              <CardHeader>
                <CardTitle><T k={`support.channel.${channel.id}.title`} /></CardTitle>
                <CardDescription><T k={`support.channel.${channel.id}.body`} /></CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={channel.href}
                  target={channel.external ? "_blank" : undefined}
                  rel={channel.external ? "noreferrer noopener" : undefined}
                  className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
                >
                  <T k={`support.channel.${channel.id}.action`} />
                </a>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight"><T k="support.fixes" /></h2>
          <Card>
            <CardContent className="divide-y divide-border/60">
              {fixes.map((index) => (
                <div
                  key={index}
                  className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1.4fr] sm:gap-6"
                >
                  <p className="font-medium"><T k={`support.fix.${index}.title`} /></p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <T k={`support.fix.${index}.body`} />
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle><T k="support.related" /></CardTitle>
              <CardDescription><T k="support.relatedBody" /></CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link
                href="/help"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                <T k="nav.help" />
              </Link>
              <Link
                href="/bookings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                <T k="nav.myVisits" />
              </Link>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle><T k="support.response.title" /></CardTitle>
              <CardDescription><T k="support.response.body" /></CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                <T k="support.response.hint" />
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
