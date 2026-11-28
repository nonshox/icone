import { Query } from "node-appwrite";
import { ArrowUpRight, Clock3, Scissors } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TABLES } from "@/lib/appwrite/db";
import { toService } from "@/lib/domain/catalog";
import { list } from "@/lib/domain/crud";
import { getBarbers } from "@/lib/domain/professional";
import { formatPrice } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export const metadata = routeMetadata({
  path: "/services",
  titleKey: "services.title",
  descriptionKey: "services.subtitle",
});

async function ServiceList() {
  let services;
  let names = new Map<string, string>();
  try {
    const rows = await list(TABLES.services, [
      Query.equal("active", true),
      Query.orderAsc("sort"),
      Query.limit(200),
    ]);
    services = rows.map(toService);
    const owners = await getBarbers(
      [...new Set(services.map((service) => service.barber).filter(Boolean))],
    );
    names = new Map([...owners.entries()].map(([id, barber]) => [id, barber.name]));
  } catch {
    return (
      <Card>
        <CardContent role="alert" className="py-10 text-center text-sm text-destructive">
          <T k="services.loadError" />
        </CardContent>
      </Card>
    );
  }

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <T k="services.empty" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
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
              <h2 className="mt-3 font-medium">{service.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {service.note || <T k="services.fallback" />}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden />
                  {service.time} <T k="common.minutes" />
                </span>
                <span className="truncate">{service.barber ? names.get(service.barber) ?? "" : "icone"}</span>
              </div>
              <Link
                href={`/book?service=${service.id}${service.barber ? `&barber=${service.barber}` : ""}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-lg")}
              >
                <T k="services.book" />
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-44 w-full" />
      ))}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="services.title" /></h1>
        <p className="mt-1 text-sm text-muted-foreground"><T k="services.subtitle" /></p>
        <div className="mt-6">
          <Suspense fallback={<ListSkeleton />}>
            <ServiceList />
          </Suspense>
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/book" className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}>
            <T k="barbers.bookChair" />
          </Link>
        </div>
      </main>
    </div>
  );
}
