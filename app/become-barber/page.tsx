import type { Metadata } from "next";
import { Suspense } from "react";

import { BecomeBarberForm } from "@/components/applications/become-barber-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Become a barber",
  robots: { index: false, follow: false },
};

async function ApplyGate() {
  await requireUser("/become-barber");
  return <BecomeBarberForm />;
}

export default function BecomeBarberPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Become a barber</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run your own chair on icone.
        </p>
        <div className="mt-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ApplyGate />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
