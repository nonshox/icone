import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthOptions } from "@/components/auth/auth-options";
import { T } from "@/components/i18n/t";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to icone with a one-time email code or Telegram. No passwords.",
};

const perks = [
  "One-time code — nothing to remember",
  "Telegram sign-in in two taps",
  "Your bookings and barber, in one place",
] as const;

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect("/start");
  return null;
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-11 animate-pulse rounded-xl bg-foreground/[0.06]" />
      <div className="h-11 animate-pulse rounded-xl bg-foreground/[0.06]" />
      <div className="h-11 animate-pulse rounded-xl bg-foreground/[0.04]" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="relative min-h-dvh">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <div className="mx-auto grid min-h-dvh w-full max-w-7xl lg:grid-cols-[1.02fr_0.98fr]">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden border-r border-border/60 lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_15%_0%,var(--brand-glow),transparent_62%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 bottom-10 size-80 rounded-full border border-brand/20 bg-brand/[0.06] blur-2xl"
          />

          <div className="relative">
            <Logo />
          </div>

          <div className="relative max-w-md">
            <p className="font-display text-5xl leading-[1.05] text-balance xl:text-6xl">
              Good hair days,
              <br />
              <span className="text-gradient-brand italic">booked ahead.</span>
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              icone is a barbershop for people who would rather not wait. Sign
              in once, and your next chair is always a tap away.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-strong">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center justify-between text-xs text-muted-foreground">
            <span>Tashkent · est. 2026</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              Crafted in Uzbekistan
            </span>
          </div>
        </aside>

        {/* Auth panel */}
        <section className="flex flex-col px-6 py-8 sm:px-10">
          <div className="flex items-center justify-between">
            <Logo className="lg:hidden" />
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back home
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[26rem]">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                Members
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                <T k="auth.welcome" />
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <T k="auth.subtitle" />
              </p>

              <div className="mt-8">
                <Suspense fallback={<FormSkeleton />}>
                  <AuthOptions />
                </Suspense>
              </div>

              <p className="mt-8 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
                By continuing you agree to receive booking-related messages
                only. No newsletters, ever.
              </p>
            </div>
          </div>

          <p className="text-center text-[0.7rem] text-muted-foreground">
            Need a hand?{" "}
            <a
              href="https://t.me/icone_app_bot?start=signin"
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Message @icone_app_bot
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
