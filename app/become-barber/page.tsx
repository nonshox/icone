import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BecomeBarberForm } from "@/components/applications/become-barber-form";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata = routeMetadata({
  path: "/become-barber",
  titleKey: "apply.title",
  descriptionKey: "apply.subtitle",
  private: true,
});

async function ApplyGate() {
  await requireUser("/become-barber");
  return <BecomeBarberForm />;
}

export default function BecomeBarberPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T k="apply.title" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="apply.subtitle" />
        </p>
        <div className="mt-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ApplyGate />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
