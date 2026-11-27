import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { ShareProfile } from "@/components/share/share-profile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { imageUrl } from "@/lib/client/files";
import { businessBySlug, isPublic, listBranches } from "@/lib/domain/business";
import { shopServices } from "@/lib/domain/discovery";
import { listBusinessBarbers } from "@/lib/domain/professional";
import { firstAvailable } from "@/lib/domain/availability";
import { formatDate, formatPrice, label as timeLabel } from "@/lib/domain/time";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await businessBySlug(slug).catch(() => null);
  if (!business) return { title: "Barbershop — icone" };
  return {
    title: `${business.name} · icone`,
    description:
      business.about ||
      `${business.name} in ${business.city} — services, team and booking on icone.`,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${business.name} · icone`,
      description: business.about || `Book a barbershop in ${business.city}.`,
      images: imageUrl(business.logo) ? [imageUrl(business.logo)] : undefined,
    },
  };
}

async function ShopPanel({ slug }: { slug: string }) {
  const business =
    (await businessBySlug(slug)) ?? (await businessBySlug(decodeURIComponent(slug)));
  if (!business || !isPublic(business)) notFound();

  const [branches, barbers, services] = await Promise.all([
    listBranches(business.id),
    listBusinessBarbers(business.id),
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
              <ShareProfile path={`/shop/${slug}`} title={business.name} />
            </div>
          </div>
          {business.about ? <p className="text-sm">{business.about}</p> : null}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {business.phone ? <span>{business.phone}</span> : null}
            {business.facilities ? <span>{business.facilities}</span> : null}
          </div>
          {first ? (
            <div className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">
              <T k="shop.firstAvailable" /> {formatDate(first.date)} {timeLabel(first.start)}
              {first.barber ? " · " : ""}
              {active.find((row) => row.id === first.barber)?.name ?? ""}
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
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <span>{service.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatPrice(service.price)} · {service.time} min
                </span>
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
              <Link
                key={barber.id}
                href={`/barbers/${barber.slug || barber.id}`}
                className="block rounded-xl border border-border p-3 hover:bg-brand/5"
              >
                {barber.name}
                {barber.title ? ` · ${barber.title}` : ""}
                {barber.rating ? ` · ★ ${barber.rating}` : ""}
              </Link>
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
