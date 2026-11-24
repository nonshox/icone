import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerView } from "@/components/customer/customer-view";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { customerOverview } from "@/lib/domain/customer";
import { currentMember } from "@/lib/domain/member";

export const metadata: Metadata = {
  title: "Your space",
  robots: { index: false, follow: false },
};

async function CustomerPanel() {
  const member = await currentMember();
  if (!member) redirect(`/sign-in?next=${encodeURIComponent("/customer")}`);
  if (member.profile.role !== "client") redirect("/account");

  const overview = await customerOverview(member.user.id);

  return (
    <CustomerView user={member.user} profile={member.profile} initial={overview} />
  );
}

function CustomerSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export default function CustomerPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Your space</h1>

        <div className="mt-6">
          <Suspense fallback={<CustomerSkeleton />}>
            <CustomerPanel />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
