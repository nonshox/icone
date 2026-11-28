import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { BookingsView } from "@/components/bookings/bookings-view";
import { SiteHeader } from "@/components/layout/site-header";
import { requireUser } from "@/lib/auth/session";

export const metadata = routeMetadata({
  path: "/bookings",
  titleKey: "visits.title",
  descriptionKey: "visits.subtitle",
  private: true,
});

async function VisitsGate() {
  await requireUser("/bookings");
  return <BookingsView />;
}

function VisitsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="visits.title" /></h1>
        <p className="mt-1 text-sm text-muted-foreground"><T k="visits.subtitle" /></p>

        <div className="mt-6">
          <Suspense fallback={<VisitsSkeleton />}>
            <VisitsGate />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
