import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminView } from "@/components/admin/admin-view";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

async function AdminGate() {
  const member = await currentMember();

  if (!member) {
    redirect(`/sign-in?next=${encodeURIComponent("/admin")}`);
  }

  if (member.profile.role !== "admin") {
    redirect("/account");
  }

  return <AdminView />;
}

function AdminSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The catalogue: chairs, services and opening hours.
        </p>

        <div className="mt-6">
          <Suspense fallback={<AdminSkeleton />}>
            <AdminGate />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
