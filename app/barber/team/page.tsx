import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { Card, CardContent } from "@/components/ui/card";
import { TeamManager } from "@/components/team/team-manager";
import { activeBusinessId, can, getActor, isOwner } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/barber/team",
  titleKey: "nav.team",
  descriptionKey: "work.team.hint",
  private: true,
});

async function TeamPanel() {
  const actor = await getActor();
  if (!actor) return null;

  // One resolver shared with the API and the other workspace pages.
  const business = activeBusinessId(actor);

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
