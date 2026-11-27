import type { Metadata } from "next";
import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { CustomerView } from "@/components/customer/customer-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Your space",
  robots: { index: false, follow: false },
};

async function CustomerPanel() {
  await requireUser("/customer");
  return <CustomerView />;
}

function CustomerSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export default function CustomerPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="customer.eyebrow" /></h1>

        <div className="mt-6">
          <Suspense fallback={<CustomerSkeleton />}>
            <CustomerPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
