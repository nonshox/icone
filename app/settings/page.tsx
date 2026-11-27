import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsView } from "@/components/customer/settings-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getSettings } from "@/lib/domain/customer";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

async function SettingsPanel() {
  const member = await currentMember();
  if (!member) redirect(`/sign-in?next=${encodeURIComponent("/settings")}`);
  if (member.profile.role !== "client") redirect("/account");

  const settings = await getSettings(member.user.id);

  return (
    <SettingsView user={member.user} profile={settings.profile} initial={settings} />
  );
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
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <div className="mt-6">
          <Suspense fallback={<SettingsSkeleton />}>
            <SettingsPanel />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
