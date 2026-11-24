import { ArrowUpRight, Clock3, Crown, Scissors, Sparkles } from "lucide-react";
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
    description: "Consultation, wash, precision cut and a clean finish.",
    duration: "45 min",
    price: "80 000 UZS",
  },
  {
    icon: Sparkles,
    name: "Beard sculpt",
    description: "Line-up, shape and a hot-towel finish.",
    duration: "30 min",
    price: "50 000 UZS",
  },
  {
    icon: Crown,
    name: "The full reset",
    description: "Cut, beard, hot towel and styling in one visit.",
    duration: "75 min",
    price: "120 000 UZS",
  },
] as const;

const steps = [
  { number: "01", title: "Sign in", body: "A one-time code or Telegram — no password." },
  { number: "02", title: "Choose a chair", body: "Pick a barber, a service and a live open time." },
  { number: "03", title: "Show up sharp", body: "Arrive five minutes early. Your barber is ready." },
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
        <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-12 sm:pt-20 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
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

              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Book Tashkent&apos;s sharpest barbers in seconds. No calls, no
                queues, no passwords.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
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

              <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span>Email one-time code</span>
                <span>Telegram sign-in</span>
                <span>30-second setup</span>
              </p>
            </div>

            <BookingPreview />
          </div>
        </section>

        {/* Services */}
        <section
          id="services"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-16 sm:pt-20"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
                The menu
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
                Three services. Zero fuss.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Every cut starts with a consultation.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
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
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-16 sm:pt-20"
        >
          <div className="glass rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              How it works
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              From locked out to lined up.
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="relative">
                  <span className="font-display text-4xl leading-none text-brand-strong/80 italic">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-base font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 sm:pt-20">
          <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-16">
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
              <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
                Sign in once, pick a time, and we&apos;ll hold the chair.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                  href="/become-barber"
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Become a barber
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
