import { redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { StaffView } from "@/components/staff/staff-view";
import { getActor } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/agenda/me",
  titleKey: "work.staff.chair",
  descriptionKey: "work.staff.chairHint",
  private: true,
});

async function StaffGate() {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent("/agenda/me")}`);
  }

  if (actor.profile.role === "admin") {
    redirect("/admin");
  }

  // A promoted account may still book as a customer. A chair or an active
  // team membership is what grants access to this workspace.
  if (!actor.summary.staff) {
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
    <BarberShell
      title={<T k="work.staff.chair" />}
      description={<T k="work.staff.chairHint" />}
      signInNext="/agenda/me"
    >
      <Suspense fallback={<StaffSkeleton />}>
        <StaffGate />
      </Suspense>
    </BarberShell>
  );
}
