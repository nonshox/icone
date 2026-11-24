import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Help",
  description: "How booking, visits and notifications work at icone.",
};

const steps = [
  {
    title: "Pick a service",
    body: "Choose a cut. Prices are in UZS and each entry shows the duration.",
  },
  {
    title: "Choose your barber",
    body: "Browse chairs, reviews, hours and recent work.",
  },
  {
    title: "Reserve a time",
    body: "Free slots appear on a 15-minute grid, with 30 minutes of lead time for same-day visits.",
  },
  {
    title: "Show up",
    body: "Your booking appears under My visits with the address and time.",
  },
];

const questions = [
  {
    question: "How do I sign in?",
    answer: "No password: use an email code or the Telegram Mini App. Your session stays in an HttpOnly cookie.",
  },
  {
    question: "Can I cancel a booking?",
    answer: "Yes. Cancel a future booking under My visits.",
  },
  {
    question: "How far ahead can I book?",
    answer: "Up to 60 days, based on each barber's weekly hours and date overrides.",
  },
  {
    question: "What if a slot disappears?",
    answer: "Two people can see the same time; the earlier request keeps it.",
  },
  {
    question: "When can I leave a review?",
    answer: "Once the visit is marked completed, one review per booking.",
  },
  {
    question: "Where do I change my details?",
    answer: "In Settings: name, phone, avatar and notification choices.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Help
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Booking, step by step.
          </h1>
        </div>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">How a booking works</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => (
              <Card key={step.title} size="sm" className="h-full">
                <CardContent className="space-y-2">
                  <p className="text-xs font-medium tabular-nums text-brand-strong">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Common questions</h2>
          <Card>
            <CardContent className="divide-y divide-border/60">
              {questions.map((item) => (
                <div key={item.question} className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                  <p className="font-medium">{item.question}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Still stuck?</CardTitle>
              <CardDescription>Ask us directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/support"
                className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
              >
                Contact support
              </Link>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <CardDescription>Details and sign-out live here.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link
                href="/settings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                Settings
              </Link>
              <Link
                href="/bookings"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
              >
                My visits
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
