"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useBarberEarnings } from "@/lib/api/barber-queries";
import { useShopDate } from "@/lib/client/date";
import { addDays, formatDate, formatPrice } from "@/lib/domain/time";
import type { EarningsFilter } from "@/lib/domain/barber-business";

import { Empty, FormError, LoadingRows, message } from "./barber-ui";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
    </div>
  );
}

export function BarberEarnings() {
  const shopDate = useShopDate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [service, setService] = useState("all");
  const [status, setStatus] = useState<EarningsFilter["status"]>("done");

  const rangeFrom = from || (shopDate ? addDays(shopDate, -29) : "");
  const rangeTo = to || shopDate;
  const filter: EarningsFilter = {
    from: rangeFrom,
    to: rangeTo,
    service: service === "all" ? "" : service,
    status,
  };
  const earnings = useBarberEarnings(filter);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>From your chair.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="earnings-from">From</Label>
            <Input id="earnings-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earnings-to">To</Label>
            <Input id="earnings-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earnings-service">Service</Label>
            <Select value={service} onValueChange={(value) => setService(value ?? "all")}>
              <SelectTrigger id="earnings-service" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {(earnings.data?.services ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earnings-status">Bookings</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as EarningsFilter["status"])}>
              <SelectTrigger id="earnings-status" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="done">Completed</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="all">All active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {earnings.isPending ? (
        <LoadingRows />
      ) : earnings.isError ? (
        <FormError text={message(earnings.error, "Could not load your earnings.")} />
      ) : !earnings.data ? (
        <Empty>No data for this range.</Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Bookings" value={earnings.data.counts.bookings} />
            <Metric label="Completed" value={earnings.data.counts.completed} />
            <Metric label="Customers" value={earnings.data.counts.customers} />
            <Metric label="Returning" value={earnings.data.counts.returning} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Booked" value={formatPrice(earnings.data.revenue.booked)} />
            <Metric label="Completed" value={formatPrice(earnings.data.revenue.completed)} />
            <Metric label="Paid received" value={formatPrice(earnings.data.revenue.paid)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Avg booking" value={formatPrice(earnings.data.averages.booking)} />
            <Metric label="Avg per customer" value={formatPrice(earnings.data.averages.customer)} />
            <Metric label="Rating" value={earnings.data.averages.rating.toFixed(1)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Popular services</CardTitle>
                <CardDescription>By bookings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {earnings.data.popularServices.length === 0 ? (
                  <Empty>No services in this range.</Empty>
                ) : (
                  earnings.data.popularServices.map((item) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {item.count} · {formatPrice(item.revenue)}
                        </span>
                      </div>
                      <Bar share={(item.count / Math.max(1, earnings.data!.counts.bookings)) * 100} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Popular times</CardTitle>
                <CardDescription>Busiest hours.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {earnings.data.popularTimes.length === 0 ? (
                  <Empty>No times in this range.</Empty>
                ) : (
                  earnings.data.popularTimes.slice(0, 8).map((item) => (
                    <div key={item.hour} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium tabular-nums">{item.time}</span>
                        <span className="tabular-nums text-muted-foreground">{item.count} bookings</span>
                      </div>
                      <Bar share={(item.count / Math.max(1, earnings.data!.counts.bookings)) * 100} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Day by day</CardTitle>
              <CardDescription>{earnings.data.range.from} to {earnings.data.range.to}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {earnings.data.byDay.length === 0 ? (
                <Empty>No bookings in this range.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.data.byDay.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{day.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPrice(day.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
