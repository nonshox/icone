import { redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { AgendaView } from "@/components/agenda/agenda-view";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { can, getActor } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/agenda",
  titleKey: "nav.calendar",
  descriptionKey: "work.agenda.hint",
  private: true,
});

async function AgendaGate() {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent("/agenda")}`);
  }

  // An approved account may still be a customer; only a chair or a team
  // membership grants access to the professional calendar.
  if (!actor.summary.staff && actor.profile.role !== "admin") {
    redirect("/account");
  }

  return (
    <AgendaView
      role={actor.profile.role}
      canPickBarber={can(actor, "calendar.read.all")}
      ownBarberId={actor.barber?.id ?? ""}
    />
  );
}

function AgendaSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-10 w-44 animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AgendaPage() {
  return (
    <BarberShell
      title={<T k="nav.calendar" />}
      description={<T k="work.agenda.hint" />}
      signInNext="/agenda"
    >
      <Suspense fallback={<AgendaSkeleton />}>
        <AgendaGate />
      </Suspense>
    </BarberShell>
  );
}
