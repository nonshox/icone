import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { StaffView } from "@/components/staff/staff-view";
import { getActor } from "@/lib/domain/access";

export const metadata: Metadata = {
  title: "My chair",
  robots: { index: false, follow: false },
};

async function StaffGate() {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent("/agenda/me")}`);
  }

  if (actor.profile.role === "admin") {
    redirect("/admin");
  }

  if (actor.profile.role !== "barber") {
    redirect("/account");
  }

  return <StaffView />;
}

function StaffSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function MyChairPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T k="work.staff.chair" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="work.staff.chairHint" />
        </p>

        <div className="mt-6">
          <Suspense fallback={<StaffSkeleton />}>
            <StaffGate />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
