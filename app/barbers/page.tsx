import Link from "next/link";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchResults } from "@/components/search/search-results";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata = routeMetadata({
  path: "/barbers",
  titleKey: "barbers.title",
  descriptionKey: "barbers.subtitle",
});

async function BarberResults({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // minChars=0 makes this a directory when there is no query and the same
  // live result list as the header and landing search when there is one.
  return (
    <div className="rounded-2xl border border-border/70 bg-background/40 p-2 sm:p-3">
      <SearchResults
        query={q ?? ""}
        limit={24}
        minChars={0}
        hideHint
        hideFooter
        showSpecialtyFilter
        emptyKey="barbers.empty"
        errorKey="barbers.loadError"
        allKey="landing.searchAll"
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 p-3" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
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
            <BarberResults searchParams={searchParams} />
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
