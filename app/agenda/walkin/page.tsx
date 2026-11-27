import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { WalkinForm } from "@/components/walkin/walkin-form";

export const metadata: Metadata = {
  title: "Walk-in — icone",
  robots: { index: false, follow: false },
};

export default function WalkinPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Walk-in visit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a customer who arrived without a booking. The time is
          blocked for online booking immediately.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}
          >
            <WalkinForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
