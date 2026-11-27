import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { NotificationsView } from "@/components/customer/notifications-view";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

async function NotificationsPanel() {
  const member = await currentMember();
  if (!member) redirect(`/sign-in?next=${encodeURIComponent("/notifications")}`);
  if (member.profile.role !== "client") redirect("/account");

  return <NotificationsView profile={member.profile} />;
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>

        <div className="mt-6">
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsPanel />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
