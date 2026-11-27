import type { Metadata } from "next";
import { Suspense } from "react";

import { MessagesView } from "@/components/messages/messages-view";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

import { getActor } from "@/lib/domain/access";
import { getBarber } from "@/lib/domain/professional";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

type Search = { searchParams: Promise<{ with?: string; barber?: string }> };

async function MessagesGate({ searchParams }: Search) {
  const params = await searchParams;
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?next=${encodeURIComponent("/messages")}`);

  let target: string | null = null;

  if (params.barber) {
    // A booking holds a barber id; conversations are between user ids.
    const barber = await getBarber(params.barber.slice(0, 36));
    target = barber?.user ?? null;
  } else if (params.with) {
    target = params.with.slice(0, 36);
  }

  return <MessagesView initialWith={target} />;
}

function MessagesSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]" aria-hidden>
      <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="h-80 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}

export default function MessagesPage({ searchParams }: Search) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A direct line to your barber.
        </p>

        <div className="mt-6">
          <Suspense fallback={<MessagesSkeleton />}>
            <MessagesGate searchParams={searchParams} />
          </Suspense>
        </div>
      </main>

    </div>
  );
}
