"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminDashboard } from "@/lib/api/admin-queries";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";

import {
  Bars,
  Empty,
  FormError,
  Section,
  StatCard,
  message,
} from "./admin-ui";

type HistogramPoint = { label: string; value: number };
type Activity = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
};

/** The dashboard endpoint returns counts plus small histograms and audit rows. */
type DashboardSnapshot = {
  users?: number;
  barbers?: number;
  businesses?: number;
  branches?: number;
  applications?: number;
  pendingApplications?: number;
  bookings?: number;
  todayBookings?: number;
  reviews?: number;
  flaggedReviews?: number;
  openReports?: number;
  openTickets?: number;
  pendingInvites?: number;
  bookingsInRange?: number;
  cancellationRate?: number;
  retention?: number;
  byStatus?: HistogramPoint[];
  byDay?: HistogramPoint[];
  byService?: HistogramPoint[];
  recent?: Activity[];
};

function count(value: number | undefined): string {
  return String(value ?? 0);
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
  const t = useT();

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Section title={<T k="nav.admin" />}>
        <FormError text={message(query.error, t("admin.loadError"))} />
      </Section>
    );
  }

  const stats = query.data as unknown as DashboardSnapshot;
  const statusRows = stats.byStatus ?? [];
  const recent = stats.recent ?? [];
  const services = stats.byService ?? [];
  const days = stats.byDay ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={<T k="admin.usersTotal" />} value={count(stats.users)} />
        <StatCard label={<T k="admin.barbersTotal" />} value={count(stats.barbers)} />
        <StatCard label={<T k="admin.businessesTotal" />} value={count(stats.businesses)} />
        <StatCard label={<T k="admin.branchesTotal" />} value={count(stats.branches)} />
        <StatCard label={<T k="admin.todayVisits" />} value={count(stats.todayBookings)} />
        <StatCard label={<T k="admin.bookingsTotal" />} value={count(stats.bookings)} />
        <StatCard
          label={<T k="admin.bookingsInRange" />}
          value={count(stats.bookingsInRange)}
        />
        <StatCard
          label={<T k="admin.pendingApps" />}
          value={count(stats.pendingApplications)}
        />
        <StatCard label={<T k="admin.reviewsTotal" />} value={count(stats.reviews)} />
        <StatCard label={<T k="admin.flagged" />} value={count(stats.flaggedReviews)} />
        <Link href="/admin/moderation#reports" className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={<T k="admin.openReports" />}
            value={count(stats.openReports)}
            note={<T k="admin.viewQueue" />}
          />
        </Link>
        <Link href="/admin/moderation#tickets" className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            label={<T k="admin.openTickets" />}
            value={count(stats.openTickets)}
            note={<T k="admin.viewQueue" />}
          />
        </Link>
        <StatCard label={<T k="admin.invites" />} value={count(stats.pendingInvites)} />
        <StatCard
          label={<T k="admin.cancellationRate" />}
          value={`${stats.cancellationRate ?? 0}%`}
        />
        <StatCard
          label={<T k="admin.retention" />}
          value={`${stats.retention ?? 0}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={<T k="admin.byStatus" />}>
          {statusRows.length === 0 ? (
            <Empty><T k="common.noData" /></Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><T k="common.status" /></TableHead>
                    <TableHead className="text-right"><T k="admin.count" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        <Section title={<T k="admin.recentActivity" />}>
          {recent.length === 0 ? (
            <Empty><T k="admin.noActivity" /></Empty>
          ) : (
            <ul className="divide-y">
              {recent.map((item) => (
                <li key={item.id} className="flex gap-3 py-2">
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
        <Section title={<T k="admin.popularServices" />}>
          {services.length === 0 ? (
            <Empty><T k="common.noData" /></Empty>
          ) : (
            <Bars points={services} />
          )}
        </Section>
        <Section title={<T k="admin.bookingsByDay" />}>
          {days.length === 0 ? (
            <Empty><T k="common.noData" /></Empty>
          ) : (
            <Bars points={days} />
          )}
        </Section>
      </div>
    </div>
  );
}
