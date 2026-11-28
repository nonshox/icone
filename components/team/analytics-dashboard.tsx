"use client";

import { useState, type ReactNode } from "react";

import { Empty, FormError, message } from "@/components/barber/barber-ui";
import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  useAnalytics,
  type AnalyticsKey,
  type HistogramRow,
} from "@/lib/api/team-queries";
import { useT } from "@/lib/i18n/use-t";

const RANGES: Array<{ key: AnalyticsKey; label: string }> = [
  { key: "week", label: "work.analytics.week" },
  { key: "month", label: "work.analytics.month" },
  { key: "quarter", label: "work.analytics.quarter" },
];

function Stat({ label, value }: { label: ReactNode; value: string | number }) {
  return <StatCard label={label} value={value} />;
}

function HistogramCard({ title, rows }: { title: ReactNode; rows: HistogramRow[] }) {
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
            {rows.slice(0, 8).map((row, index) => (
              <li
                key={`${row.label}-${index}`}
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

export function AnalyticsDashboard({ business }: { business: string }) {
  const t = useT();
  const [range, setRange] = useState<AnalyticsKey>("month");
  const analytics = useAnalytics({ business, range });
  const stats = analytics.data?.stats;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <T k="nav.analytics" />
              </CardTitle>
              <CardDescription>
                <T k="work.analytics.range" />
              </CardDescription>
            </div>
            <div
              className="flex flex-wrap gap-1 rounded-xl border border-border p-1"
              role="group"
              aria-label={t("work.analytics.period")}
            >
              {RANGES.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={range === option.key ? "secondary" : "ghost"}
                  disabled={analytics.isFetching}
                  onClick={() => setRange(option.key)}
                >
                  {t(option.label)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analytics.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : analytics.isError ? (
            <div className="space-y-3">
              <FormError text={message(analytics.error, t("work.loadError"))} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void analytics.refetch()}
              >
                <T k="common.tryAgain" />
              </Button>
            </div>
          ) : !stats ? (
            <Empty>{t("work.analytics.empty")}</Empty>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label={<T k="work.analytics.total" />} value={stats.total} />
                <Stat label={<T k="common.completed" />} value={stats.completed} />
                <Stat label={<T k="status.pending" />} value={stats.pending} />
                <Stat label={<T k="status.confirmed" />} value={stats.confirmed} />
                <Stat label={<T k="work.analytics.cancelled" />} value={stats.cancelled} />
                <Stat label={<T k="work.analytics.noShow" />} value={stats.noShow} />
                <Stat label={<T k="work.analytics.retention" />} value={`${stats.retention}%`} />
                <Stat label={<T k="work.analytics.perDay" />} value={stats.perDay} />
              </div>
              {stats.total === 0 ? (
                <Empty>{t("work.analytics.empty")}</Empty>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {stats && !analytics.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <HistogramCard title={<T k="work.analytics.byStatus" />} rows={stats.byStatus} />
          <HistogramCard
            title={<T k="work.analytics.popular" />}
            rows={analytics.data?.popular ?? []}
          />
          <HistogramCard title={<T k="work.analytics.byService" />} rows={stats.byService} />
          <HistogramCard title={<T k="work.analytics.byBarber" />} rows={stats.byBarber} />
          <HistogramCard title={<T k="work.analytics.byBranch" />} rows={stats.byBranch} />
        </div>
      ) : null}
    </div>
  );
}
