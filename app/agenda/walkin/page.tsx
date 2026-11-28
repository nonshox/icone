import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { WalkinForm } from "@/components/walkin/walkin-form";

export const metadata = routeMetadata({
  path: "/agenda/walkin",
  titleKey: "walkin.title",
  descriptionKey: "walkin.subtitle",
  private: true,
});

export default function WalkinPage() {
  return (
    <BarberShell
      title={<T k="walkin.title" />}
      description={<T k="walkin.subtitle" />}
      signInNext="/agenda/walkin"
    >
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}
      >
        <WalkinForm />
      </Suspense>
    </BarberShell>
  );
}
