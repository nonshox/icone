import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { FavoritesView } from "@/components/customer/favorites-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata = routeMetadata({
  path: "/favorites",
  titleKey: "favorites.title",
  descriptionKey: "meta.private.description",
  private: true,
});

async function FavoritesPanel() {
  await requireUser("/favorites");
  return <FavoritesView />;
}

function FavoritesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight"><T k="favorites.title" /></h1>

        <div className="mt-6">
          <Suspense fallback={<FavoritesSkeleton />}>
            <FavoritesPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
