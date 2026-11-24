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
import { STATUS_LABEL, type Status } from "@/lib/domain/types";

import type { ReportPoint } from "@/lib/api/admin-queries";

export function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  title: string;
  description?: string;
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
  label: string;
  value: string;
  note?: string;
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
  return (
    <Badge
      variant={
        status === "done"
          ? "secondary"
          : status === "cancel" || status === "noshow" || status === "rejected"
            ? "destructive"
            : "outline"
      }
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** Minimal CSS chart. Heights come only from the supplied real figures. */
export function Bars({
  points,
  mode = "count",
  format,
}: {
  points: ReportPoint[];
  mode?: "count" | "value";
  format?: (value: number) => string;
}) {
  if (points.length === 0) return <Empty>No data in this range.</Empty>;

  const values = points.map((point) =>
    mode === "value" ? point.value : point.count,
  );
  const max = Math.max(1, ...values);
  const first = points[0]?.date ?? "";
  const last = points[points.length - 1]?.date ?? "";
  const render = (value: number) =>
    format ? format(value) : value.toLocaleString("ru-RU");

  return (
    <div>
      <div
        className="flex h-28 items-end gap-1"
        role="img"
        aria-label={`${mode === "value" ? "Revenue" : "Volume"} over ${points.length} periods`}
      >
        {values.map((value, index) => (
          <div
            key={`${points[index]?.date ?? index}-${index}`}
            className="min-w-0 flex-1 rounded-t-sm bg-primary/70"
            style={{ height: `${Math.max(2, Math.round((value / max) * 100))}%` }}
            title={`${points[index]?.date}: ${render(value)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{first}</span>
        <span className="tabular-nums">peak {render(max)}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
