import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { Card, CardContent } from "@/components/ui/card";
import { BranchManager } from "@/components/team/branch-manager";
import { activeBusinessId, can, getActor } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/barber/branches",
  titleKey: "nav.branches",
  descriptionKey: "work.branches.hint",
  private: true,
});

async function BranchesPanel() {
  const actor = await getActor();
  if (!actor) return null;

  const business = activeBusinessId(actor);

  if (!business) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.branches.noBusiness" />
        </CardContent>
      </Card>
    );
  }
  if (!can(actor, "branch.read", { business })) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.branches.denied" />
        </CardContent>
      </Card>
    );
  }

  return (
    <BranchManager
      business={business}
      canManage={can(actor, "branch.manage", { business })}
    />
  );
}

export default function BranchesPage() {
  return (
    <BarberShell
      title={<T k="nav.branches" />}
      description={<T k="work.branches.hint" />}
    >
      <Suspense fallback={<BarberSkeleton />}>
        <BranchesPanel />
      </Suspense>
    </BarberShell>
  );
}
