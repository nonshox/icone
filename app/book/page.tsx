import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BookingForm } from "@/components/booking/booking-form";
import { DraftSync } from "@/components/booking/draft-sync";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { requireUser } from "@/lib/auth/session";

export const metadata = routeMetadata({
  path: "/book",
  titleKey: "booking.title",
  descriptionKey: "booking.subtitle",
  private: true,
});

async function BookGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  const search = query.toString();
  await requireUser(search ? `/book?${search}` : "/book");
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

export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
          <Suspense fallback={<FormSkeleton />}>
            <BookGate searchParams={searchParams} />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
