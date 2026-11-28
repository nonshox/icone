import type { ComponentType, ReactNode } from "react";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** One KPI card for the customer, professional and admin dashboards. */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  href,
  className,
}: {
  label: ReactNode;
  value: string | number;
  note?: ReactNode;
  icon?: StatIcon;
  href?: string;
  className?: string;
}) {
  const card = (
    <Card className={cn("glass", className)}>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          {note ? (
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          ) : null}
        </div>
        {Icon ? (
          <Icon className="size-4 shrink-0 text-brand-strong" aria-hidden />
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </Link>
    );
  }

  return card;
}
