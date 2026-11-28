"use client";

import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n/use-t";

import type { ReportPoint } from "@/lib/api/admin-queries";

/** Shared app surfaces live in `components/ui`, never duplicated per area. */
export {
  EmptyState,
  EmptyState as Empty,
  ErrorState,
  FormError,
  LoadingRows,
  message,
} from "@/components/ui/app-state";
export { StatusBadge } from "@/components/ui/status-badge";
export { StatCard } from "@/components/ui/stat-card";

export function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Minimal CSS chart. Heights come only from the supplied real figures. */
export function Bars({
  points,
  format,
}: {
  points: ReportPoint[];
  format?: (value: number) => string;
}) {
  const t = useT();
  const values = points.map((point) => point.value);
  const max = Math.max(1, ...values);
  const render = (value: number) =>
    format ? format(value) : value.toLocaleString("ru-RU");

  return (
    <div>
      <div
        className="flex h-28 items-end gap-1"
        role="img"
        aria-label={t("admin.chart").replace("{count}", String(points.length))}
      >
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="min-w-0 flex-1 rounded-t-sm bg-primary/70"
            style={{
              height: `${Math.max(2, Math.round((point.value / max) * 100))}%`,
            }}
            title={`${point.label}: ${render(point.value)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{points[0]?.label ?? ""}</span>
        <span className="shrink-0 tabular-nums">
          {t("admin.peak")} {render(max)}
        </span>
        <span className="min-w-0 truncate text-right">
          {points[points.length - 1]?.label ?? ""}
        </span>
      </div>
    </div>
  );
}
