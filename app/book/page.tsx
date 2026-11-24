import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingForm } from "@/components/booking/booking-form";
import { DraftSync } from "@/components/booking/draft-sync";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Book a chair",
  description: "Pick a service, a barber and a time at icone in Tashkent.",
  robots: { index: false, follow: false },
};

async function BookGate() {
  await requireUser("/book");
  return <BookingForm />;
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function BookPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Book a chair</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a service, a barber and a time. It takes a few seconds.
        </p>

        <div className="mt-6">
          <Suspense fallback={null}>
            <DraftSync />
          </Suspense>
          <Suspense fallback={<FormSkeleton />}>
            <BookGate />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
