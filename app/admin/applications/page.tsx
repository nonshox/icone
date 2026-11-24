import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminApplicationsView } from "@/components/applications/admin-applications-view";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

async function Gate() {
  const member = await currentMember();
  if (!member) redirect(`/sign-in?next=${encodeURIComponent("/admin/applications")}`);
  if (member.profile.role !== "admin") redirect("/account");
  return <AdminApplicationsView />;
}

export default function ApplicationsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <div className="mt-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Gate />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
