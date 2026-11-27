import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { MapView } from "@/components/map/map-view";

export const metadata = {
  title: "Map — icone",
  description: "Find barbers and barbershops near you on the map.",
};

async function MapWithQuery({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MapView initialQ={q ?? ""} />;
}

export default function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 pb-20 sm:px-6 md:pb-8">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="nav.map" /></h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="map.subtitle" />
        </p>
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="h-[420px] animate-pulse rounded-2xl bg-muted" aria-hidden />
            }
          >
            <MapWithQuery searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
