import { ArrowUpRight, Clock3, MapPin, Scissors, Star } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { T } from "@/components/i18n/t";
import { BookingPreview } from "@/components/marketing/booking-preview";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listBarbers, listServices } from "@/lib/domain/data";
import { formatPrice } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const steps = [
  { number: "01", titleKey: "landing.step1", bodyKey: "landing.step1Body" },
  { number: "02", titleKey: "landing.step2", bodyKey: "landing.step2Body" },
  { number: "03", titleKey: "landing.step3", bodyKey: "landing.step3Body" },
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
};

async function LandingContent() {
  const [services, barbers] = await Promise.all([
    listServices(),
    listBarbers(),
  ]);

  const featured = barbers.filter((barber) => barber.featured);
  const shown = (featured.length > 0 ? featured : barbers).slice(0, 3);

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-10 sm:px-6 sm:pt-16 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
          <div className="min-w-0">
            <div className="glass-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
              </span>
              <T k="landing.badge" />
            </div>

            <h1 className="mt-5 max-w-xl text-[2.25rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
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
                  "glass-soft h-12 gap-2 rounded-xl px-6 text-sm",
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
          </div>

          <BookingPreview barbers={barbers.slice(0, 3)} services={services.slice(0, 1)} />
        </div>
      </section>

      <section
        id="services"
        className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 pt-14 sm:px-6 sm:pt-20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              The menu
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-4xl">
              <T k="landing.popular" />            </h2>
          </div>
          <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground">
            <T k="landing.allServices" /> →
          </Link>
        </div>

        {services.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              The menu is being prepared.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 6).map((service) => (
              <Card key={service.id} size="sm" className="h-full">
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid size-9 place-items-center rounded-xl bg-brand/12 text-brand-strong">
                        <Scissors className="size-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatPrice(service.price)}
                      </span>
                    </div>
                    <h3 className="mt-3 font-medium">{service.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.note || "Barber service"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden />
                      {service.time} min
                    </span>
                    <Link
                      href={`/book?service=${service.id}`}
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-strong"
                    >
                      Book
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              <T k="landing.chairs" />
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-4xl">
              <T k="landing.featured" />
            </h2>
          </div>
          <Link href="/barbers" className="text-sm text-muted-foreground hover:text-foreground">
            <T k="landing.allBarbers" /> →
          </Link>
        </div>

        {shown.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No barbers yet.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((barber) => (
              <Card key={barber.id} size="sm" className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{barber.name}</CardTitle>
                      <p className="truncate text-sm text-muted-foreground">
                        {barber.shop || barber.title || "Barber"}
                      </p>
                    </div>
                    {barber.rating > 0 ? (
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="size-3" aria-hidden />
                        {barber.rating.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {barber.bio || "Precision cuts and a calm chair."}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden />
                    {barber.city}
                  </p>
                  <Link
                    href={`/barbers/${barber.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-lg")}
                  >
                    View profile
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="glass rounded-[1.5rem] p-5 sm:p-8">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="landing.how" />
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
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

      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-6 sm:px-6 sm:pt-20">
        <div className="glass rounded-[1.5rem] px-5 py-10 text-center sm:px-12">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Your next cut
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">
            <T k="landing.ready" />
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            <T k="landing.finalSub" />
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 rounded-xl px-6 text-sm")}
            >
              <T k="nav.book" />
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/become-barber"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <T k="nav.becomeBarber" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function LandingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-12 sm:px-6" aria-hidden>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <main id="main" className="flex-1">
        <Suspense fallback={<LandingSkeleton />}>
          <LandingContent />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
