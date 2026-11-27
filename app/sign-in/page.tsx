import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthOptions } from "@/components/auth/auth-options";
import { T } from "@/components/i18n/t";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/next-path";
import { publicConfig } from "@/lib/public-config";

const botLink = `https://t.me/${publicConfig.telegramBotUsername}?start=web`;

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to icone with Telegram. No password, no email, no SMS.",
};

async function RedirectIfSignedIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) {
    redirect(safeNextPath(Array.isArray(next) ? next[0] : next));
  }
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

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <div className="relative min-h-dvh">
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
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
              <T k="auth.brandLine1" />
              <br />
              <span className="text-gradient-brand italic">
                <T k="auth.brandLine2" />
              </span>
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              <T k="auth.brandBody" />
            </p>

          </div>

          <div className="relative flex items-center justify-between text-xs text-muted-foreground">
            <span><T k="auth.est" /></span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              <T k="auth.crafted" />
            </span>
          </div>
        </aside>

        {/* Auth panel */}
        <section className="flex flex-col px-6 py-8 sm:px-10">
          <div className="flex items-center justify-between">
            <Logo className="lg:hidden" />
          </div>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[26rem]">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                <T k="auth.members" />
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
                <T k="auth.legal" />
              </p>
            </div>
          </div>

          <p className="text-center text-[0.7rem] text-muted-foreground">
            <T k="auth.needHelp" />{" "}
            <a
              href={botLink}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground underline-offset-4 hover:underline"
            >
              <T k="auth.messageBot" />
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
