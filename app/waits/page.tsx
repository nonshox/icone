import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { WaitlistView } from "@/components/waitlist/waitlist-view";

export const metadata: Metadata = {
  title: "Waitlist — icone",
  robots: { index: false, follow: false },
};

export default function WaitsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We will reach out on Telegram as soon as a time opens up.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}
          >
            <WaitlistView />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
