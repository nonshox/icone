"use client";

import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminDashboard } from "@/lib/api/admin-queries";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/domain/types";
import { formatPrice } from "@/lib/domain/time";

import {
  Empty,
  FormError,
  Section,
  StatCard,
  message,
} from "./admin-ui";

function growthNote(value: number): string {
  if (value > 0) return `+${value}% vs prior 30 days`;
  if (value < 0) return `${value}% vs prior 30 days`;
  return "Flat vs prior 30 days";
}

function ActivityMark({ kind }: { kind: string }) {
  const label = kind.slice(0, 1).toUpperCase();
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function DashboardView() {
  const query = useAdminDashboard();
  const stats = query.data;

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (query.isError || !stats) {
    return (
      <Section title="Dashboard">
        <FormError text={message(query.error, "Could not load the dashboard.")} />
      </Section>
    );
  }

  const statusRows: Array<{ status: Status; count: number }> = STATUSES.map(
    (status) => ({ status, count: stats.byStatus[status] ?? 0 }),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={String(stats.totals.users)}
          note={growthNote(stats.growth.users)}
        />
        <StatCard
          label="Customers"
          value={String(stats.totals.customers)}
          note={`${stats.totals.staff} staff accounts`}
        />
        <StatCard
          label="Barbers"
          value={String(stats.totals.barbers)}
          note={`${stats.totals.chairs} chairs · ${stats.totals.activeBusinesses} active businesses`}
        />
        <StatCard
          label="Appointments"
          value={String(stats.totals.bookings)}
          note={growthNote(stats.growth.bookings)}
        />
        <StatCard
          label="Revenue"
          value={formatPrice(stats.totals.revenue)}
          note={growthNote(stats.growth.revenue)}
        />
        <StatCard
          label="Booked value"
          value={formatPrice(stats.totals.bookedValue)}
          note="Non-cancelled bookings"
        />
        <StatCard
          label="Cancellation rate"
          value={`${stats.cancellationRate}%`}
          note="Cancelled / all appointments"
        />
        <StatCard
          label="Reviews"
          value={String(stats.totals.reviews)}
          note={`${stats.featured} featured chairs`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Appointments by status" description="Every booking, counted once.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusRows.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>{STATUS_LABEL[row.status]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Recent activity" description="Newest records across the platform.">
          {stats.recent.length === 0 ? (
            <Empty>No activity recorded yet.</Empty>
          ) : (
            <ul className="divide-y">
              {stats.recent.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex gap-3 py-2">
                  <ActivityMark kind={item.kind} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.detail} · {item.at.slice(0, 10)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankedList
          title="Popular services"
          rows={stats.popularServices.map((item) => ({
            name: item.name,
            count: item.count,
            extra: formatPrice(item.value),
          }))}
        />
        <RankedList
          title="Popular locations"
          rows={stats.cities.map((item) => ({
            name: item.name,
            count: item.count,
            extra: "bookings",
          }))}
        />
      </div>
    </div>
  );
}

function RankedList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; count: number; extra: string | ReactNode }>;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <Empty>Nothing to rank yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.count} · {row.extra}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
