import type { Metadata } from "next";
import { Suspense } from "react";

import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { Card, CardContent } from "@/components/ui/card";
import { TeamManager } from "@/components/team/team-manager";
import { can, getActor, isOwner } from "@/lib/domain/access";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

async function TeamPanel() {
  const actor = await getActor();
  if (!actor) return null;

  // Match the API's business resolution so the client never asks for a scope
  // the route handler would silently redirect or reject.
  const business =
    actor.owns[0] ??
    actor.memberships.find(
      (row) => row.role === "owner" || row.role === "manager",
    )?.business ??
    actor.memberships[0]?.business ??
    "";

  if (!business) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.team.noBusiness" />
        </CardContent>
      </Card>
    );
  }
  if (!can(actor, "team.read", { business })) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.team.denied" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamManager
      business={business}
      canManage={can(actor, "team.manage", { business })}
      canPromoteOwner={isOwner(actor, business)}
    />
  );
}

export default function TeamPage() {
  return (
    <BarberShell title={<T k="nav.team" />} description={<T k="work.team.hint" />}>
      <Suspense fallback={<BarberSkeleton />}>
        <TeamPanel />
      </Suspense>
    </BarberShell>
  );
}
