import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can, getActor } from "@/lib/domain/access";
import { computeStats, lastDays, type Histogram } from "@/lib/domain/stats";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

function Stat({ label, value }: { label: ReactNode; value: string | number }) {
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function HistogramCard({ title, rows }: { title: ReactNode; rows: Histogram }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <T k="work.analytics.empty" />
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.slice(0, 8).map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{row.label || "—"}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function AnalyticsPanel() {
  const actor = await getActor();
  if (!actor) return null;

  const business = actor.owns[0] ?? actor.memberships[0]?.business ?? "";
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

  const stats = await computeStats({ business, range: lastDays(30) });

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="nav.analytics" />
          </CardTitle>
          <CardDescription>
            <T k="work.analytics.range" />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={<T k="work.analytics.total" />} value={stats.total} />
          <Stat
            label={<T k="common.completed" />}
            value={stats.completed}
          />
          <Stat label={<T k="status.pending" />} value={stats.pending} />
          <Stat label={<T k="status.confirmed" />} value={stats.confirmed} />
          <Stat
            label={<T k="work.analytics.cancelled" />}
            value={stats.cancelled}
          />
          <Stat
            label={<T k="work.analytics.noShow" />}
            value={stats.noShow}
          />
          <Stat
            label={<T k="work.analytics.retention" />}
            value={`${stats.retention}%`}
          />
          <Stat
            label={<T k="work.analytics.perDay" />}
            value={stats.perDay}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <HistogramCard
          title={<T k="work.analytics.byStatus" />}
          rows={stats.byStatus}
        />
        <HistogramCard
          title={<T k="work.analytics.byService" />}
          rows={stats.byService}
        />
        <HistogramCard
          title={<T k="work.analytics.byBarber" />}
          rows={stats.byBarber}
        />
        <HistogramCard
          title={<T k="work.analytics.byBranch" />}
          rows={stats.byBranch}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <BarberShell
      title="Analytics"
      description="Real numbers from your bookings."
    >
      <Suspense fallback={<BarberSkeleton />}>
        <AnalyticsPanel />
      </Suspense>
    </BarberShell>
  );
}
