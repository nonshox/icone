import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FavoritesView } from "@/components/customer/favorites-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Saved barbers",
  robots: { index: false, follow: false },
};

async function FavoritesPanel() {
  const member = await currentMember();
  if (!member) redirect(`/sign-in?next=${encodeURIComponent("/favorites")}`);
  if (member.profile.role !== "client") redirect("/account");

  return <FavoritesView profile={member.profile} />;
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

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Saved barbers</h1>

        <div className="mt-6">
          <Suspense fallback={<FavoritesSkeleton />}>
            <FavoritesPanel />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
