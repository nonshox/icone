import { redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { WaitlistView } from "@/components/waitlist/waitlist-view";
import { getActor } from "@/lib/domain/access";

async function WaitlistGate() {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?next=${encodeURIComponent("/waits")}`);
  return <WaitlistView />;
}

export const metadata = routeMetadata({
  path: "/waits",
  titleKey: "waitlist.pageTitle",
  descriptionKey: "waitlist.pageSubtitle",
  private: true,
});

export default function WaitsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="waitlist.pageTitle" /></h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="waitlist.pageSubtitle" />
        </p>
        <div className="mt-6">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}
          >
            <WaitlistGate />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
