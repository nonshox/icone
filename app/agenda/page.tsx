import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AgendaView } from "@/components/agenda/agenda-view";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { getActor } from "@/lib/domain/access";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

async function AgendaGate() {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent("/agenda")}`);
  }

  if (actor.profile.role === "client") {
    redirect("/account");
  }

  return <AgendaView role={actor.profile.role} />;
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
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T k="nav.agenda" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="work.agenda.hint" />
        </p>

        <div className="mt-6">
          <Suspense fallback={<AgendaSkeleton />}>
            <AgendaGate />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
