import { ArrowUpRight, Clock3, Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TABLES } from "@/lib/appwrite/db";
import { getMany, listServices } from "@/lib/domain/data";
import { formatPrice } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Services",
  description: "Barber services and prices at icone.",
};

async function ServiceList() {
  const services = await listServices();
  const barberRows =
    services.length > 0
      ? await getMany(
          TABLES.barbers,
          services.map((service) => service.barber),
        )
      : [];
  const names = new Map(barberRows.map((row) => [row.$id, String(row.name)]));

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active services yet.
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
                {service.note || "Barber service"}
              </p>
              {service.discount > 0 ? (
                <p className="mt-2 text-xs font-medium text-emerald-500">
                  {service.discount}% off available
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden />
                  {service.time} min
                </span>
                <span>{names.get(service.barber) ?? "icone"}</span>
              </div>
              <Link
                href={`/book?service=${service.id}${service.barber ? `&barber=${service.barber}` : ""}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full rounded-lg")}
              >
                Book
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
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prices and durations.</p>
        <div className="mt-6">
          <Suspense fallback={<ListSkeleton />}>
            <ServiceList />
          </Suspense>
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/book" className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}>
            Book a chair
          </Link>
        </div>
      </main>

    </div>
  );
}
