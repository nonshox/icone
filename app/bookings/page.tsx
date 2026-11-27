import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingsView } from "@/components/bookings/bookings-view";
import { SiteHeader } from "@/components/layout/site-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "My visits",
  robots: { index: false, follow: false },
};

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

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">My visits</h1>

        <div className="mt-6">
          <Suspense fallback={<VisitsSkeleton />}>
            <VisitsGate />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
