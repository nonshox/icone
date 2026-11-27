"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { useAdminReports } from "@/lib/api/admin-queries";

import { Bars, Empty, FormError, LoadingRows, Section, StatCard, message } from "./admin-ui";

type HistogramPoint = { label: string; value: number };

/** Reports are built from real bookings; no money is handled on the platform. */
type ReportSnapshot = {
  from?: string;
  to?: string;
  total?: number;
  completed?: number;
  cancelled?: number;
  noShow?: number;
  retention?: number;
  cancellationRate?: number;
  byDay?: HistogramPoint[];
  byService?: HistogramPoint[];
  byBarber?: HistogramPoint[];
  byStatus?: HistogramPoint[];
  popularServices?: HistogramPoint[];
  points?: HistogramPoint[];
};

export function ReportsView() {
  const t = useT();
  const [days, setDays] = useState(30);
  const query = useAdminReports(days);

  if (query.isPending) {
    return <LoadingRows />;
  }

  if (query.isError || !query.data) {
    return (
      <Section title={<T k="admin.reports.title" />}>
        <FormError text={message(query.error, t("admin.loadError"))} />
      </Section>
    );
  }

  const report = query.data as unknown as ReportSnapshot;
  const bookings = report.byDay ?? report.points ?? [];
  const services = report.popularServices ?? report.byService ?? [];
  const barbers = report.byBarber ?? [];
  const statuses = report.byStatus ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-range"><T k="admin.range" /></Label>
          <Select
            value={String(days)}
            onValueChange={(value) => setDays(Number(value))}
          >
            <SelectTrigger id="report-range" className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30"><T k="admin.last30Days" /></SelectItem>
              <SelectItem value="90"><T k="admin.last90Days" /></SelectItem>
              <SelectItem value="365"><T k="admin.last12Months" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
        {report.from || report.to ? (
          <p className="pb-2 text-xs text-muted-foreground">
            {report.from ?? ""} → {report.to ?? ""}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={<T k="admin.bookingsInRange" />} value={String(report.total ?? 0)} />
        <StatCard label={<T k="admin.done" />} value={String(report.completed ?? 0)} />
        <StatCard label={<T k="admin.cancelledNoShow" />} value={`${report.cancelled ?? 0} / ${report.noShow ?? 0}`} />
        <StatCard label={<T k="admin.retention" />} value={`${report.retention ?? 0}%`} />
        <StatCard
          label={<T k="admin.cancellationRate" />}
          value={`${report.cancellationRate ?? 0}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={<T k="admin.bookingsByDay" />}>
          {bookings.length === 0 ? <Empty><T k="admin.noDataInRange" /></Empty> : <Bars points={bookings} />}
        </Section>
        <Section title={<T k="admin.byStatus" />}>
          {statuses.length === 0 ? <Empty><T k="admin.noDataInRange" /></Empty> : <Bars points={statuses} />}
        </Section>
        <Section title={<T k="admin.popularServices" />}>
          {services.length === 0 ? <Empty><T k="admin.noDataInRange" /></Empty> : <Bars points={services} />}
        </Section>
        <Section title={<T k="admin.byBarber" />}>
          {barbers.length === 0 ? <Empty><T k="admin.noDataInRange" /></Empty> : <Bars points={barbers} />}
        </Section>
      </div>

      <Section title={<T k="admin.popularServices" />}>
        {services.length === 0 ? (
          <Empty><T k="admin.noDataInRange" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="admin.service" /></TableHead>
                  <TableHead className="text-right"><T k="admin.count" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service, index) => (
                  <TableRow key={`${service.label}-${index}`}>
                    <TableCell>{service.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
