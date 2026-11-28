import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";
import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsDashboard } from "@/components/team/analytics-dashboard";
import { activeBusinessId, can, getActor } from "@/lib/domain/access";

export const metadata = routeMetadata({
  path: "/barber/analytics",
  titleKey: "nav.analytics",
  descriptionKey: "work.analytics.range",
  private: true,
});

async function AnalyticsPanel() {
  const actor = await getActor();
  if (!actor) return null;

  const business = activeBusinessId(actor);
  if (!business) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.analytics.noBusiness" />
        </CardContent>
      </Card>
    );
  }
  if (!can(actor, "analytics.read", { business })) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.analytics.denied" />
        </CardContent>
      </Card>
    );
  }

  return <AnalyticsDashboard business={business} />;
}

export default function AnalyticsPage() {
  return (
    <BarberShell
      title={<T k="nav.analytics" />}
      description={<T k="work.dashboard.quickHint" />}
    >
      <Suspense fallback={<BarberSkeleton />}>
        <AnalyticsPanel />
      </Suspense>
    </BarberShell>
  );
}
