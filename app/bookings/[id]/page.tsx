import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingDetail } from "@/components/bookings/booking-detail";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Visit details",
  robots: { index: false, follow: false },
};

async function DetailGate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/bookings/${id}`);
  return <BookingDetail id={id} />;
}

function BookingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="space-y-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Visit details</h1>

        <div className="mt-6">
          <Suspense fallback={<BookingSkeleton />}>
            <DetailGate params={params} />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
