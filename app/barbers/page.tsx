import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BarberDirectory } from "@/components/barbers/barber-directory";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listBarbers } from "@/lib/domain/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Barbers",
  description: "Meet the barbers behind the chairs at icone in Tashkent.",
};

async function BarberList() {
  const barbers = await listBarbers();

  if (barbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          The chair list is being prepared. Check back shortly.
        </CardContent>
      </Card>
    );
  }

  return <BarberDirectory barbers={barbers} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function BarbersPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">The chairs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every cut starts with a consultation.
        </p>

        <div className="mt-6">
          <Suspense fallback={<ListSkeleton />}>
            <BarberList />
          </Suspense>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/book"
            className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
          >
            Book a chair
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
