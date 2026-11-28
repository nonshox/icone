import { redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SettingsView } from "@/components/customer/settings-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/settings",
  titleKey: "nav.settings",
  descriptionKey: "meta.private.description",
  private: true,
});

async function SettingsPanel() {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?next=${encodeURIComponent("/settings")}`);
  // One account can be both customer and professional: keep customer
  // settings available to everybody after sign-in.
  return <SettingsView />;
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]" aria-hidden>
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="nav.settings" /></h1>

        <div className="mt-6">
          <Suspense fallback={<SettingsSkeleton />}>
            <SettingsPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
