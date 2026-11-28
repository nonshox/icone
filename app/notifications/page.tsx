import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { NotificationsView } from "@/components/customer/notifications-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata = routeMetadata({
  path: "/notifications",
  titleKey: "nav.inbox",
  descriptionKey: "inbox.newUpdates",
  private: true,
});

async function NotificationsPanel() {
  // The inbox works for every signed-in account; professionals and customers
  // share the same component, which adapts its copy to the account's role.
  await requireUser("/notifications");
  return <NotificationsView />;
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
        <h1 className="text-2xl font-semibold tracking-tight"><T k="nav.inbox" /></h1>

        <div className="mt-6">
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
