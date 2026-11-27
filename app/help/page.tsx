import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { T } from "@/components/i18n/t";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Help & FAQs",
  description:
    "How to book, cancel and review a visit at icone. Sign-in with Telegram, live availability, waitlist and team invitations explained.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Help & FAQs · icone",
    description: "Everything about booking, visits and your icone account.",
    url: "/help",
  },
};

const steps = [
  { number: "01", title: "help.step1", body: "help.step1Body" },
  { number: "02", title: "help.step2", body: "help.step2Body" },
  { number: "03", title: "help.step3", body: "help.step3Body" },
  { number: "04", title: "help.step4", body: "help.step4Body" },
] as const;

const faqs = [
  { q: "help.q1", a: "help.a1" },
  { q: "help.q2", a: "help.a2" },
  { q: "help.q3", a: "help.a3" },
  { q: "help.q4", a: "help.a4" },
  { q: "help.q5", a: "help.a5" },
  { q: "help.q6", a: "help.a6" },
  { q: "help.q7", a: "help.a7" },
  { q: "help.q8", a: "help.a8" },
] as const;

const linkGroups = [
  {
    title: "nav.discover",
    links: [
      { href: "/book", label: "nav.book" },
      { href: "/barbers", label: "nav.barbers" },
      { href: "/services", label: "nav.services" },
      { href: "/map", label: "nav.map" },
      { href: "/waits", label: "nav.waitlist" },
    ],
  },
  {
    title: "help.yourAccount",
    links: [
      { href: "/bookings", label: "nav.myVisits" },
      { href: "/favorites", label: "nav.saved" },
      { href: "/settings", label: "nav.settings" },
      { href: "/messages", label: "nav.messages" },
    ],
  },
  {
    title: "nav.forBarbers",
    links: [
      { href: "/become-barber", label: "nav.becomeBarber" },
      { href: "/become-barber?model=b", label: "nav.openShop" },
      { href: "/invites", label: "nav.team" },
    ],
  },
  {
    title: "help.stillStuck",
    links: [
      { href: "/support", label: "nav.contact" },
      { href: "/legal/terms", label: "nav.terms" },
      { href: "/legal/privacy", label: "nav.privacy" },
    ],
  },
] as const;

export default function HelpPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-12 sm:px-6">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="help.eyebrow" />
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            <T k="help.title" />
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <T k="help.intro" />
          </p>
        </div>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight"><T k="landing.how" /></h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <p className="text-xs font-medium tabular-nums text-brand-strong">{step.number}</p>
                <h3 className="mt-2 font-medium"><T k={step.title} /></h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground"><T k={step.body} /></p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight"><T k="help.faqTitle" /></h2>
          <div className="space-y-2">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border/70 bg-card/60 px-4 py-3"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  <T k={item.q} />
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground"><T k={item.a} /></p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight"><T k="nav.help" /></h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {linkGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <h3 className="text-[0.65rem] font-medium tracking-[0.14em] text-brand-strong uppercase">
                  <T k={group.title} />
                </h3>
                <ul className="mt-3 grid gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        <T k={link.label} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <h2 className="font-medium"><T k="help.stillStuck" /></h2>
            <p className="mt-1 text-sm text-muted-foreground"><T k="help.stillStuckBody" /></p>
            <Link
              href="/support"
              className={cn(buttonVariants({ size: "sm" }), "mt-4 h-9 rounded-xl")}
            >
              <T k="help.contactSupport" />
            </Link>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <h2 className="font-medium"><T k="help.yourAccount" /></h2>
            <p className="mt-1 text-sm text-muted-foreground"><T k="help.accountBody" /></p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/settings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                <T k="nav.settings" />
              </Link>
              <Link
                href="/bookings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                <T k="nav.myVisits" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
