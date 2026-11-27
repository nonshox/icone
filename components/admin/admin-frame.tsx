import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { T } from "@/components/i18n/t";

import { AdminGate } from "./admin-gate";
import { AdminNav } from "./admin-nav";

function FrameSkeleton() {
  return (
    <div className="space-y-3 py-6" aria-hidden>
      <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

/** Shared shell for every admin page. The role gate stays behind Suspense. */
export function AdminFrame({
  titleKey,
  descriptionKey,
  children,
}: {
  titleKey: string;
  descriptionKey: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T k="nav.admin" />
        </h1>

        <div className="mt-6">
          <AdminNav />
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              <T k={titleKey} />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <T k={descriptionKey} />
            </p>
          </div>

          <Suspense fallback={<FrameSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
