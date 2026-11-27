"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/use-t";

import { T } from "@/components/i18n/t";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBarberDashboard } from "@/lib/api/barber-queries";

import { Empty, LoadingRows, message } from "./barber-ui";

const LINKS = [
  { href: "/agenda", key: "nav.agenda" },
  { href: "/barber/services", key: "nav.services" },
  { href: "/barber/customers", key: "nav.myVisits" },
  { href: "/barber/portfolio", key: "nav.profile" },
  { href: "/barber/notifications", key: "nav.inbox" },
  { href: "/agenda/me", key: "work.staff.toDashboard" },
  { href: "/api/barber/export?range=month", key: "work.export" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
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

export function BarberDashboard() {
  const dashboard = useBarberDashboard();
  const t = useT();

  if (dashboard.isPending) return <LoadingRows />;
  if (dashboard.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {message(dashboard.error, t("work.loadError"))}
      </p>
    );
  }

  const data = dashboard.data;
  if (!data) return <Empty>{t("work.loadError")}</Empty>;

  const quiet =
    data.today + data.upcoming + data.pending + data.completed === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("common.today")} value={data.today} />
        <Stat label={t("common.upcoming")} value={data.upcoming} />
        <Stat label={t("work.stat.pending")} value={data.pending} />
        <Stat label={t("common.completed")} value={data.completed} />
        <Stat label={t("work.stat.clients")} value={data.clients} />
        <Stat label={t("work.stat.returning")} value={data.returning} />
        <Stat
          label={t("work.stat.rating")}
          value={data.rating > 0 ? data.rating.toFixed(1) : "—"}
        />
        <Stat label={t("work.stat.views")} value={data.views} />
      </div>

      {quiet ? <Empty>{t("work.dashboard.empty")}</Empty> : null}

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.dashboard.quick" />
          </CardTitle>
          <CardDescription>
            <T k="work.dashboard.quickHint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground"
            >
              <T k={link.key} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
