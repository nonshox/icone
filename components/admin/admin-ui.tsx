"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/use-t";
import { STATUS_LABEL, type Status } from "@/lib/domain/types";

import type { ReportPoint } from "@/lib/api/admin-queries";

export function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" aria-live="polite" className="text-sm text-destructive">
      {text}
    </p>
  );
}

export function LoadingRows() {
  return (
    <div className="space-y-2 py-2" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

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

export function StatCard({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: string;
  note?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        {note ? (
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  const label = t(`status.${status}`);
  return (
    <Badge
      variant={
        status === "done"
          ? "secondary"
          : status === "cancelled" || status === "noshow" || status === "rejected"
            ? "destructive"
            : "outline"
      }
    >
      {label.startsWith("status.") ? (STATUS_LABEL[status] ?? status) : label}
    </Badge>
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
  const render = (value: number) => (format ? format(value) : value.toLocaleString("ru-RU"));

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
            style={{ height: `${Math.max(2, Math.round((point.value / max) * 100))}%` }}
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
