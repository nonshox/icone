import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { T } from "@/components/i18n/t";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  { number: "01", titleKey: "landing.step1", bodyKey: "landing.step1Body" },
  { number: "02", titleKey: "landing.step2", bodyKey: "landing.step2Body" },
  { number: "03", titleKey: "landing.step3", bodyKey: "landing.step3Body" },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
          <div className="glass-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand shadow-[0_0_12px_-2px_var(--brand)]"
            />
            <T k="landing.badge" />
          </div>

          <h1 className="mt-5 max-w-2xl text-[2.25rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
            <T k="landing.heroA" />{" "}
            <span className="font-display text-gradient-brand pr-1 text-[1.05em] leading-[0.9] font-normal italic">
              <T k="landing.heroB" />
            </span>
          </h1>

          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            <T k="landing.subtitle" />
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/book"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 gap-2 rounded-xl px-6 text-sm",
              )}
            >
              <T k="nav.book" />
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/barbers"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 gap-2 rounded-xl px-6 text-sm",
              )}
            >
              <T k="landing.explore" />
            </Link>
          </div>

          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span><T k="landing.signCode" /></span>
            <span><T k="landing.telegram" /></span>
            <span><T k="landing.live" /></span>
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="glass rounded-[1.5rem] p-5 sm:p-8">
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              <T k="landing.how" />
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
              <T k="landing.howTitle" />
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number}>
                  <span className="font-display text-3xl leading-none text-brand-strong/80 italic">
                    {step.number}
                  </span>
                  <h3 className="mt-2 font-medium"><T k={step.titleKey} /></h3>
                  <p className="mt-1 text-sm text-muted-foreground"><T k={step.bodyKey} /></p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
