import {
  ArrowUpRight,
  Clock3,
  Crown,
  Mail,
  MapPin,
  Phone,
  Scissors,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { BookingPreview } from "@/components/marketing/booking-preview";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const services = [
  {
    icon: Scissors,
    name: "Signature cut",
    description:
      "Consultation, wash, precision cut and a finish that survives the week.",
    duration: "45 min",
    price: "80 000 UZS",
  },
  {
    icon: Sparkles,
    name: "Beard sculpt",
    description:
      "Line-up, shape and a hot-towel finish. Clean edges, no guesswork.",
    duration: "30 min",
    price: "50 000 UZS",
  },
  {
    icon: Crown,
    name: "The full reset",
    description:
      "Cut, beard, hot towel and styling. Walk in tired, walk out sharp.",
    duration: "75 min",
    price: "120 000 UZS",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Sign in, in seconds",
    body: "A one-time email code or Telegram. No password to create, forget or leak.",
  },
  {
    number: "02",
    title: "Choose your chair",
    body: "Pick a barber, a service and a time. Open times are live, so you only see what you can actually book.",
  },
  {
    number: "03",
    title: "Show up sharp",
    body: "Arrive five minutes early. Your barber already knows what you booked.",
  },
] as const;

const hours = [
  { days: "Monday — Friday", time: "09:00 — 22:00" },
  { days: "Saturday", time: "10:00 — 22:00" },
  { days: "Sunday", time: "10:00 — 20:00" },
] as const;

const marquee = [
  "One-time sign-in",
  "Email or Telegram",
  "No passwords",
  "Open 7 days",
  "Tashkent, UZ",
] as const;

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Barbershop",
  name: "icone",
  url: site,
  telephone: "+998712001212",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "12 Amir Temur Avenue, Yakkasaray",
    addressLocality: "Tashkent",
    addressCountry: "UZ",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "22:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: "10:00",
      closes: "22:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday"],
      opens: "10:00",
      closes: "20:00",
    },
  ],
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-16 sm:pt-20 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
            <div>
              <div className="glass-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                Now booking in Tashkent
              </div>

              <h1 className="mt-6 max-w-xl text-[2.85rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl xl:text-[4.6rem]">
                Your chair is{" "}
                <span className="font-display text-gradient-brand pr-1 text-[1.05em] leading-[0.9] font-normal italic">
                  waiting.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Book Tashkent&apos;s sharpest barbers in seconds. No calls, no
                queues, no passwords — just a clean cut, on your time.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 gap-2 rounded-xl px-6 text-sm shadow-lg shadow-foreground/10",
                  )}
                >
                  Book a chair
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/#services"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "glass-soft h-12 gap-2 rounded-xl px-6 text-sm",
                  )}
                >
                  Explore the menu
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-brand-strong" aria-hidden />
                  Email one-time code
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Send className="size-3.5 text-brand-strong" aria-hidden />
                  Telegram sign-in
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="size-3.5 text-brand-strong" aria-hidden />
                  30-second setup
                </span>
              </div>
            </div>

            <BookingPreview />
          </div>
        </section>

        {/* Marquee strip */}
        <section
          aria-label="Highlights"
          className="border-y border-border/60 bg-foreground/[0.02]"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-4 text-xs tracking-wide text-muted-foreground uppercase">
            {marquee.map((item, index) => (
              <span key={item} className="flex items-center gap-8">
                {index > 0 ? (
                  <span aria-hidden className="text-brand/60">
                    ✦
                  </span>
                ) : null}
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Services */}
        <section
          id="services"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-20 sm:pt-28"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                The menu
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Three services. Zero fuss.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every service starts with a consultation. Tell us the look —
              we&apos;ll keep it consistent visit after visit.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.name}
                  className="glass group relative flex flex-col rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-brand/12 text-brand-strong ring-1 ring-brand/20">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {service.price}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-medium tracking-[-0.01em]">
                    {service.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                  <Separator className="my-5 opacity-60" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden />
                      {service.duration}
                    </span>
                    <Link
                      href="/book"
                      className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-brand-strong"
                    >
                      Book
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-20 sm:pt-28"
        >
          <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-24 size-72 rounded-full bg-brand/15 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                How it works
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                  From locked out to{" "}
                  <span className="font-display text-[1.08em] font-normal italic">
                    lined up.
                  </span>
                </h2>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Sign-in and booking are live. Your chair, your history and
                  your reviews live in one account.
                </p>
              </div>

              <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
                {steps.map((step) => (
                  <div key={step.number} className="relative">
                    <span className="font-display text-4xl leading-none text-brand-strong/80 italic">
                      {step.number}
                    </span>
                    <h3 className="mt-4 text-base font-medium">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Hours + location */}
        <section
          id="hours"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-20 sm:pt-28"
        >
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="glass rounded-3xl p-6 sm:p-8">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                Find us
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                A quiet corner in the city.
              </h2>
              <div className="mt-6 space-y-4 text-sm">
                <p className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                  12 Amir Temur Avenue, Yakkasaray, Tashkent
                </p>
                <p className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="size-4 shrink-0 text-brand-strong" aria-hidden />
                  <a
                    href="tel:+998712001212"
                    className="transition-colors hover:text-foreground"
                  >
                    +998 71 200 12 12
                  </a>
                </p>
                <p className="flex items-center gap-3 text-muted-foreground">
                  <Send className="size-4 shrink-0 text-brand-strong" aria-hidden />
                  <a
                    href="https://t.me/icone_app_bot"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition-colors hover:text-foreground"
                  >
                    @icone_app_bot
                  </a>
                </p>
              </div>

              <div className="mt-8 rounded-2xl border border-border/70 bg-foreground/[0.025] p-4 text-xs leading-relaxed text-muted-foreground">
                Walk-ins are welcome when a chair is free — but the good slots
                go to people who book.
              </div>
            </div>

            <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                  Opening hours
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-500">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Open today
                </span>
              </div>

              <div className="mt-6 divide-y divide-border/60">
                {hours.map((row) => (
                  <div
                    key={row.days}
                    className="flex items-center justify-between py-3.5 text-sm"
                  >
                    <span className="text-muted-foreground">{row.days}</span>
                    <span className="font-medium tabular-nums">{row.time}</span>
                  </div>
                ))}
              </div>

              <div
                aria-hidden
                className="mt-6 h-28 rounded-2xl border border-border/60 bg-[linear-gradient(180deg,var(--surface-sunken),transparent)] bg-[length:22px_22px] bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] opacity-80"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Two minutes from Amir Temur metro. Look for the brass dot.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-20 sm:pt-28">
          <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-40 mx-auto size-96 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                Your next cut
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                Ready for a sharper{" "}
                <span className="font-display text-[1.08em] font-normal italic">
                  look?
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                Sign in once, then pick a service and a time. One-time code or
                Telegram — no password to remember.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 gap-2 rounded-xl px-6 text-sm",
                  )}
                >
                  Book a chair
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/#how"
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  See how it works
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
