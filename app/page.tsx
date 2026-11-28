import { ArrowRight, ArrowUpRight, CircleHelp, Map, Scissors } from "lucide-react";
import Link from "next/link";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { LandingSearch } from "@/components/landing/landing-search";
import { ProfessionalRail } from "@/components/landing/professional-rail";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = routeMetadata({
  path: "/",
  titleKey: "meta.home.title",
  descriptionKey: "meta.home.description",
  absolute: true,
});

const steps = [
  { number: "01", titleKey: "landing.step1", bodyKey: "landing.step1Body" },
  { number: "02", titleKey: "landing.step2", bodyKey: "landing.step2Body" },
  { number: "03", titleKey: "landing.step3", bodyKey: "landing.step3Body" },
] as const;

const destinations = [
  {
    href: "/become-barber",
    label: "nav.becomeBarber",
    body: "landing.linkBarberBody",
    Icon: Scissors,
  },
  {
    href: "/map",
    label: "nav.map",
    body: "landing.linkMapBody",
    Icon: Map,
  },
  {
    href: "/help",
    label: "nav.help",
    body: "landing.linkHelpBody",
    Icon: CircleHelp,
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
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

          <p className="mt-5 text-xs text-muted-foreground">
            <T k="landing.telegramOnly" />
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <LandingSearch />

          <ProfessionalRail
            eyebrowKey="landing.availableEyebrow"
            titleKey="landing.availableTitle"
            bodyKey="landing.availableBody"
            endpoint="/api/search?sort=soonest&limit=12"
            moreHref="/map"
            todayOnly
          />

          <ProfessionalRail
            eyebrowKey="landing.popularEyebrow"
            titleKey="landing.popularTitle"
            bodyKey="landing.popularBody"
            endpoint="/api/search?sort=reviews&limit=4"
            moreHref="/barbers"
          />
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            <T k="landing.howTitle" />
          </h2>
          <p className="mt-2 text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="landing.how" />
          </p>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number} className="flex items-start gap-4">
                <span className="font-display text-3xl leading-none text-brand-strong/80 italic">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-medium"><T k={step.titleKey} /></h3>
                  <p className="mt-1 text-sm text-muted-foreground"><T k={step.bodyKey} /></p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map(({ href, label, body, Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-40 flex-col rounded-2xl border border-border/70 bg-card/60 p-5 transition-colors hover:border-brand/60 hover:bg-brand/5"
              >
                <Icon className="size-5 text-brand-strong" aria-hidden />
                <h2 className="mt-5 font-medium"><T k={label} /></h2>
                <p className="mt-1 text-sm text-muted-foreground"><T k={body} /></p>
                <ArrowRight
                  className="mt-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="landing.faqEyebrow" />
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            <T k="landing.faqTitle" />
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2">
            <li>
              <h3 className="font-medium"><T k="landing.faq1" /></h3>
              <p className="mt-1 text-sm text-muted-foreground"><T k="landing.faq1a" /></p>
            </li>
            <li>
              <h3 className="font-medium"><T k="landing.faq2" /></h3>
              <p className="mt-1 text-sm text-muted-foreground"><T k="landing.faq2a" /></p>
            </li>
          </ol>
          <Link
            href="/help"
            className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            <T k="landing.faqMore" />
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <div className="glass-soft flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.035em] sm:text-2xl">
                <T k="landing.ready" />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground"><T k="landing.finalSub" /></p>
            </div>
            <Link
              href="/book"
              className={cn(buttonVariants({ size: "lg" }), "h-11 shrink-0 rounded-xl px-6 text-sm")}
            >
              <T k="nav.book" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
