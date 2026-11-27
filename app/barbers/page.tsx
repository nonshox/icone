import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BarberDirectory } from "@/components/barbers/barber-directory";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listBarbers } from "@/lib/domain/professional";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Barbers",
  description: "Meet the barbers behind the chairs at icone in Tashkent.",
};

async function BarberList({ initialQuery }: { initialQuery: string }) {
  let barbers;
  try {
    barbers = await listBarbers();
  } catch {
    return (
      <Card>
        <CardContent role="alert" className="py-10 text-center text-sm text-destructive">
          <T k="barbers.loadError" />
        </CardContent>
      </Card>
    );
  }

  if (barbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <T k="barbers.empty" />
        </CardContent>
      </Card>
    );
  }

  return <BarberDirectory barbers={barbers} initialQuery={initialQuery} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

async function FilteredList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <BarberList initialQuery={q ?? ""} />;
}

export default function BarbersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="barbers.title" /></h1>
        <p className="mt-1 text-sm text-muted-foreground"><T k="barbers.subtitle" /></p>

        <div className="mt-6">
          <Suspense fallback={<ListSkeleton />}>
            <FilteredList searchParams={searchParams} />
          </Suspense>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/book"
            className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
          >
            <T k="barbers.bookChair" />
          </Link>
        </div>
      </main>
    </div>
  );
}
