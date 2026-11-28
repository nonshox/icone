"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Empty, LoadingRows, message } from "@/components/barber/barber-ui";
import { T } from "@/components/i18n/t";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/use-t";
import { formatDate, label } from "@/lib/domain/time";
import type { Waitlist } from "@/lib/domain/types";

type WaitsData = {
  business: string;
  waits: Waitlist[];
  barbers: Array<{ id: string; name: string }>;
};

const linkClass =
  "inline-flex items-center rounded-xl border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand-strong transition-colors hover:bg-brand/15";

/**
 * Real wait requests for this workspace. The only action opens the staff
 * appointment editor prefilled with the requested chair, date and time. Staff
 * are never sent into the customer booking form.
 */
export function WaitlistManager() {
  const t = useT();
  const waits = useQuery({
    queryKey: ["barber", "waits"],
    queryFn: () => api<WaitsData>("/api/barber/waits"),
  });

  const names = new Map((waits.data?.barbers ?? []).map((row) => [row.id, row.name]));
  const rows = waits.data?.waits ?? [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.waitlist.title" />
        </CardTitle>
        <CardDescription>
          <T k="work.waitlist.hint" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {waits.isPending ? (
          <LoadingRows />
        ) : waits.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {message(waits.error, t("work.waitlist.loadError"))}
          </p>
        ) : rows.length === 0 ? (
          <Empty>{t("work.waitlist.empty")}</Empty>
        ) : (
          <ul className="space-y-2">
            {rows.map((wait) => {
              const params = new URLSearchParams({ barber: wait.barber });
              if (wait.from) params.set("date", wait.from);
              if (wait.service) params.set("service", wait.service);
              if (wait.before < 1439) params.set("start", String(wait.before));
              return (
                <li
                  key={wait.id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {names.get(wait.barber) || wait.barber.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(wait.from)}
                      {wait.to !== wait.from ? ` → ${formatDate(wait.to)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {wait.day >= 0 ? t(`day.${wait.day}`) : t("waitlist.anyDay")}
                      {" · "}
                      {wait.before < 1439
                        ? `${t("work.waitlist.before")} ${label(wait.before)}`
                        : t("work.waitlist.anyTime")}
                    </p>
                    {wait.note ? (
                      <p className="text-sm text-muted-foreground">{wait.note}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/agenda?${params.toString()}`}
                    className={linkClass}
                  >
                    <T k="work.waitlist.openAvailability" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
