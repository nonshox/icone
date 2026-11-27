import { Suspense } from "react";

import { MapView } from "@/components/map/map-view";

export const metadata = {
  title: "Map — icone",
  description: "Find barbers and barbershops near you on the map.",
};

export default function MapPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real professionals and businesses, with no invented locations.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="h-[420px] animate-pulse rounded-2xl bg-muted" aria-hidden />
          }
        >
          <MapView />
        </Suspense>
      </div>
    </main>
  );
}
