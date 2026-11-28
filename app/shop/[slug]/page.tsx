import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { MessageProfileLink } from "@/components/messages/message-profile-link";
import { ShareProfile } from "@/components/share/share-profile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { imageUrl } from "@/lib/client/files";
import { metaText } from "@/lib/metadata";
import { businessBySlug, isPublic, listBranches } from "@/lib/domain/business";
import { shopServices } from "@/lib/domain/discovery";
import { listBusinessBarbers } from "@/lib/domain/professional";
import { firstAvailable } from "@/lib/domain/availability";
import { formatDate, formatPrice, label as timeLabel } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await businessBySlug(slug).catch(() => null);
  const fallback = metaText("meta.shop.description");
  if (!business) return { title: metaText("meta.shop.title") };
  return {
    title: `${business.name} · icone`,
    description: business.about || `${business.name} — ${fallback}`,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${business.name} · icone`,
      description: business.about || fallback,
      images: imageUrl(business.logo) ? [imageUrl(business.logo)] : undefined,
    },
  };
}

async function ShopPanel({ slug }: { slug: string }) {
  const business =
    (await businessBySlug(slug)) ?? (await businessBySlug(decodeURIComponent(slug)));
  if (!business || !isPublic(business)) notFound();
  const businessId = business.id;

  const [branches, barbers, services] = await Promise.all([
    listBranches(businessId),
    listBusinessBarbers(businessId),
    shopServices(business),
  ]);
  const active = barbers.filter((row) => row.active && row.state === "active");
  const first =
    active.length > 0
      ? await firstAvailable(
          active.map((row) => row.id),
          Math.max(15, ...services.map((row) => row.time), 30),
          { days: 14 },
        )
      : null;
  const bookingBarber = first?.barber || active[0]?.id || "";
  const ctaService = [...services].sort((a, b) => a.time - b.time)[0]?.id ?? "";
  const defaultBranch =
    branches.find((branch) => branch.primary && branch.active) ??
    branches.find((branch) => branch.active) ??
    branches[0] ??
    null;

  // Prefer the real "any qualified employee" flow. Shops without a branch fall
  // back to a specific chair, which is still a valid booking link.
  function bookHref(service: string): string {
    if (defaultBranch) {
      const params = new URLSearchParams({
        any: "1",
        business: businessId,
        branch: defaultBranch.id,
        services: service,
      });
      return `/book?${params.toString()}`;
    }
    return bookingBarber
      ? `/book?barber=${encodeURIComponent(bookingBarber)}&service=${encodeURIComponent(service)}`
      : "/book";
  }

  return (
    <div className="space-y-6">
      <Card className="glass overflow-hidden">
        {business.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(business.cover)}
            alt=""
            className="h-48 w-full object-cover"
          />
        ) : null}
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap items-center gap-3">
            {business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(business.logo)}
                alt=""
                className="size-16 rounded-2xl border border-border object-cover"
              />
            ) : null}
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{business.name}</h2>
              <p className="text-sm text-muted-foreground">
                {business.city}
                {business.district ? `, ${business.district}` : ""}
                {business.address ? ` · ${business.address}` : ""}
              </p>
            </div>
            {business.verified ? <Badge><T k="shop.verified" /></Badge> : null}
            <div className="ml-auto shrink-0">
              <ShareProfile
                path={`/shop/${slug}`}
                title={business.name}
                bookingSlug={slug}
              />
            </div>
          </div>
          {business.about ? <p className="text-sm">{business.about}</p> : null}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {business.phone ? <span>{business.phone}</span> : null}
            {business.facilities ? <span>{business.facilities}</span> : null}
          </div>
          {first ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand bg-brand/10 p-3 text-sm">
              <span>
                <T k="shop.firstAvailable" /> {formatDate(first.date)}{" "}
                {timeLabel(first.start)}
                {first.barber ? " · " : ""}
                {active.find((row) => row.id === first.barber)?.name ?? ""}
              </span>
              {bookingBarber || ctaService ? (
                <Link
                  href={`/b/${slug}`}
                  className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-lg")}
                >
                  <T k="common.book" />
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              <T k="shop.noTimes" />
            </p>
          )}
          {business.policy ? (
            <p className="text-xs text-muted-foreground"><T k="shop.policy" /> {business.policy}</p>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle><T k="nav.services" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground"><T k="shop.noServices" /></p>
            ) : null}
            {services.map((service) => (
              <div
                key={service.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border p-3 text-sm"
              >
                <span>{service.name}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">
                    {formatPrice(service.price)} · {service.time}{" "}
                    <T k="common.minutes" />
                  </span>
                  <Link
                    href={bookHref(service.id)}
                    className="text-xs font-medium text-brand-strong hover:underline"
                  >
                    <T k="common.book" />
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><T k="shop.team" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {branches.map((branch) => (
              <p key={branch.id} className="rounded-xl border border-border p-3">
                {branch.name} — {branch.city}
                {branch.address ? `, ${branch.address}` : ""}
              </p>
            ))}
            {active.map((barber) => (
              <div
                key={barber.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <Link
                  href={`/barbers/${barber.slug || barber.id}`}
                  className="min-w-0 flex-1 hover:text-brand-strong"
                >
                  {barber.name}
                  {barber.title ? ` · ${barber.title}` : ""}
                  {barber.rating ? ` · ★ ${barber.rating}` : ""}
                </Link>
                <Link
                  href={`/book?barber=${encodeURIComponent(barber.id)}`}
                  className="text-xs font-medium text-brand-strong hover:underline"
                >
                  <T k="common.book" />
                </Link>
                <MessageProfileLink
                  barber={barber.id}
                  user={barber.user}
                  compact
                />
              </div>
            ))}
            {active.length === 0 && branches.length === 0 ? (
              <p className="text-muted-foreground"><T k="shop.noTeam" /></p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="shop.title" /></h1>
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="space-y-3" aria-hidden>
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            }
          >
            <ShopPanel slug={slug} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
