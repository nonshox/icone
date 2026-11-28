import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  Award,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import { FavoriteButton } from "@/components/barbers/favorite-button";
import { NextSlots } from "@/components/barbers/next-slots";
import { T } from "@/components/i18n/t";
import { MessageProfileLink } from "@/components/messages/message-profile-link";
import { ShareProfile } from "@/components/share/share-profile";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { imageUrl } from "@/lib/client/files";
import { metaText } from "@/lib/metadata";
import { servicesFor } from "@/lib/domain/catalog";
import { publicPortfolio } from "@/lib/domain/portfolio";
import { getBarber } from "@/lib/domain/professional";
import { priceOf } from "@/lib/domain/pricing";
import { reviewsWithAuthors } from "@/lib/domain/review";
import { getBarberHours } from "@/lib/domain/schedule";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import type { HourRow, PortfolioItem, Review } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const barber = await getBarber(id).catch(() => null);
  const fallback = metaText("barber.bioFallback");
  return {
    title: barber
      ? `${barber.name} · ${metaText("meta.barber.suffix")}`
      : metaText("meta.barber.title"),
    description: barber?.bio || fallback,
    robots: { index: true, follow: true },
    openGraph: barber
      ? {
          title: `${barber.name} · icone`,
          description: barber.bio || fallback,
          images: imageUrl(barber.photo) ? [imageUrl(barber.photo)] : undefined,
        }
      : undefined,
  };
}

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Plain comma- or line-separated text is the common case.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Stars({ rate }: { rate: number }) {
  const rounded = Math.round(rate);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rate} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            "size-3.5",
            index < rounded ? "fill-brand text-brand" : "text-muted-foreground/50",
          )}
        />
      ))}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function ErrorPanel() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle><T k="common.error" /></CardTitle>
        <CardDescription><T k="barbers.loadError" /></CardDescription>
      </CardHeader>
    </Card>
  );
}

async function BarberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const barber = await getBarber(id).catch(() => null);
  if (!barber || !barber.active || barber.state !== "active") notFound();

  const loaded = await Promise.all([
    getBarberHours(id).catch(() => []),
    reviewsWithAuthors(id).catch(() => [] as Review[]),
    servicesFor(id).catch(() => []),
    publicPortfolio(id).catch(() => [] as PortfolioItem[]),
  ]).catch(() => null);

  if (!loaded) return <ErrorPanel />;

  const [hours, reviews, menu, portfolio] = loaded;
  const previewService = menu.find((service) => service.featured) ?? menu[0] ?? null;
  const bookingSlug = barber.slug || barber.id;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div
            aria-hidden
            className="h-32 w-full bg-muted bg-cover bg-center sm:h-44"
            style={photoStyle(barber.cover || barber.photo)}
          />
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="-mt-9 size-20 shrink-0 rounded-full bg-muted bg-cover bg-center ring-4 ring-card"
                  style={photoStyle(barber.photo)}
                />
                <div className="min-w-0 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                      {barber.name}
                    </h2>
                    {barber.featured ? <Badge variant="secondary"><T k="barber.featured" /></Badge> : null}
                  </div>
                  <p className="text-sm text-brand-strong">
                    {barber.title || <T k="booking.barber" />}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {barber.rating > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Stars rate={barber.rating} />
                        <span className="font-medium tabular-nums text-foreground">
                          {barber.rating.toFixed(1)}
                        </span>
                        <span>({reviews.length})</span>
                      </span>
                    ) : null}
                    {barber.years > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Award className="size-3.5" aria-hidden />
                        {barber.years} <T k="barber.years" />
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <FavoriteButton barber={barber.id} />
                <MessageProfileLink barber={barber.id} user={barber.user} />
                <ShareProfile
                  path={`/barbers/${bookingSlug}`}
                  title={barber.name}
                  bookingSlug={bookingSlug}
                />
                <Link
                  href={`/b/${encodeURIComponent(bookingSlug)}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "brand-glow h-9 rounded-xl",
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  <T k="barber.bookChair" />
                </Link>
              </div>
            </div>

            {barber.shop || barber.address || barber.city ? (
              <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                {[barber.shop, barber.address, barber.city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {barber.bio || <T k="barber.bioFallback" />}
            </p>

            {splitList(barber.skills).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {splitList(barber.skills).map((skill) => (
                  <Badge key={skill} variant="outline">
                    <Scissors className="size-3" aria-hidden />
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Section title={<T k="barber.services" />} description={<T k="barber.pricesUzs" />}>
          {menu.length === 0 ? (
            <Empty><T k="barber.menuUpdating" /></Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {menu.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      {service.featured ? <Badge variant="secondary"><T k="barber.popular" /></Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.category || <T k="barber.hair" />} · {service.time}{" "}
                      <T k="common.minutes" />
                    </p>
                    {service.note ? (
                      <p className="text-sm text-muted-foreground">{service.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <p className="font-medium tabular-nums">{formatPrice(priceOf(service))}</p>
                    <Link
                      href={`/book?barber=${encodeURIComponent(barber.id)}&service=${encodeURIComponent(service.id)}`}
                      className="text-xs font-medium text-brand-strong hover:underline"
                    >
                      <T k="barber.bookLink" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={<T k="barber.recentWork" />} description={<T k="barber.fromChair" />}>
          {portfolio.length === 0 ? (
            <Empty><T k="barber.noPhotos" /></Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-xl bg-muted">
                  <div
                    aria-hidden
                    className="h-40 w-full bg-cover bg-center"
                    style={photoStyle(item.url)}
                  />
                  {item.note ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{item.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={<T k="barber.reviews" />} description={<T k="barber.fromMembers" />}>
          {reviews.length === 0 ? (
            <Empty><T k="barber.noReviews" /></Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {reviews.map((review) => (
                <li key={review.id} className="space-y-1 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {review.userName || <T k="common.member" />}
                    </span>
                    <Stars rate={review.rate} />
                  </div>
                  {review.note ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {review.note}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(review.created.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="space-y-4">
        <Section title={<T k="barber.hours" />} description={<T k="barber.tashkentTime" />}>
          {hours.length === 0 ? (
            <Empty><T k="barber.hoursUpdating" /></Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {hours
                .slice()
                .sort((a: HourRow, b: HourRow) => a.day - b.day)
                .map((row) => (
                  <li
                    key={row.day}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground"><T k={`day.${row.day}`} /></span>
                    <span className="font-medium tabular-nums">
                      {label(row.start)}–{label(row.end)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <NextSlots barber={barber.id} service={previewService} />

        <Section title={<T k="barber.goodToKnow" />} description={<T k="barber.chairDetails" />}>
          {splitList(barber.facilities).length === 0 &&
          !barber.policy &&
          !barber.phone &&
          !barber.social ? (
            <Empty><T k="barber.noDetails" /></Empty>
          ) : (
            <div className="space-y-4">
              {splitList(barber.facilities).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {splitList(barber.facilities).map((item) => (
                    <Badge key={item} variant="outline">
                      <Sparkles className="size-3" aria-hidden />
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {barber.policy ? (
                <div className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                  <p>{barber.policy}</p>
                </div>
              ) : null}
              {barber.phone ? (
                <a
                  href={`tel:${barber.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  <Phone className="size-4 text-brand-strong" aria-hidden />
                  {barber.phone}
                </a>
              ) : null}
              {barber.social ? (
                /^https?:\/\//.test(barber.social) ? (
                  <a
                    href={barber.social}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                  >
                    <ExternalLink className="size-4 text-brand-strong" aria-hidden />
                    <T k="barber.social" />
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="size-4 text-brand-strong" aria-hidden />
                    {barber.social}
                  </p>
                )
              ) : null}
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden />
                {barber.confirm ? (
                  <T k="barber.confirmYes" />
                ) : (
                  <T k="barber.confirmNo" />
                )}
              </p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-hidden>
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function BarberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/barbers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← <T k="barbers.backToList" />
        </Link>

        <div className="mt-4">
          <Suspense fallback={<DetailSkeleton />}>
            <BarberDetail params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
