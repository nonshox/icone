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
import { useAdminReports } from "@/lib/api/admin-queries";
import { formatPrice } from "@/lib/domain/time";

import { Bars, Empty, FormError, LoadingRows, Section, StatCard, message } from "./admin-ui";

export function ReportsView() {
  const [days, setDays] = useState(30);
  const query = useAdminReports(days);
  const report = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-range">Date range</Label>
          <Select
            value={String(days)}
            onValueChange={(value) => setDays(Number(value))}
          >
            <SelectTrigger id="report-range" className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {report ? (
          <p className="pb-2 text-xs text-muted-foreground">
            {report.from} → {report.to}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <LoadingRows />
      ) : query.isError || !report ? (
        <Section title="Reports">
          <FormError text={message(query.error, "Could not build the report.")} />
        </Section>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="New users"
              value={String(report.totals.users)}
              note="New profiles"
            />
            <StatCard
              label="Barber registrations"
              value={String(report.totals.barbers)}
              note="New barbers"
            />
            <StatCard
              label="Bookings"
              value={String(report.totals.bookings)}
              note={`${report.totals.done} completed`}
            />
            <StatCard
              label="Revenue"
              value={formatPrice(report.totals.revenue)}
              note="Paid"
            />
            <StatCard
              label="Cancellation rate"
              value={`${report.cancellationRate}%`}
              note={`${report.totals.cancel} cancelled · ${report.totals.noshow} no-shows`}
            />
            <StatCard
              label="Retention"
              value={`${report.retention}%`}
              note="Members with 2+ bookings"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="User growth">
              <Bars points={report.series.users} />
            </Section>
            <Section title="Barber registrations">
              <Bars points={report.series.barbers} />
            </Section>
            <Section title="Booking trends">
              <Bars points={report.series.bookings} />
            </Section>
            <Section title="Revenue">
              <Bars points={report.series.revenue} mode="value" format={formatPrice} />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Popular services">
              {report.popularServices.length === 0 ? (
                <Empty>No bookings in this range.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.popularServices.map((service) => (
                      <TableRow key={service.name}>
                        <TableCell>{service.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {service.count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(service.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
            <Section title="Active cities">
              {report.cities.length === 0 ? (
                <Empty>No bookings in this range.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.cities.map((city) => (
                      <TableRow key={city.name}>
                        <TableCell>{city.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {city.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
