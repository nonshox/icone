import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BookingForm } from "@/components/booking/booking-form";
import { DraftSync } from "@/components/booking/draft-sync";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata = routeMetadata({
  path: "/book",
  titleKey: "booking.title",
  descriptionKey: "booking.subtitle",
});

/**
 * Public until confirm: services and live availability are open to everyone.
 * The only authenticated step is final submit, guarded in /api/bookings and
 * redirected from the form itself with the draft preserved in the URL.
 */
export default function BookPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="booking.title" /></h1>
        <p className="mt-1 text-sm text-muted-foreground"><T k="booking.subtitle" /></p>

        <div className="mt-6">
          <Suspense fallback={null}>
            <DraftSync />
          </Suspense>
          <BookingForm />
        </div>
      </main>

    </div>
  );
}
