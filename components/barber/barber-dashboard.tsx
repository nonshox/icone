"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatPrice } from "@/lib/domain/time";
import { useBarberDashboard } from "@/lib/api/barber-queries";

import { Empty, LoadingRows, message, StatusBadge } from "./barber-ui";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function BarberDashboard() {
  const dashboard = useBarberDashboard();

  if (dashboard.isPending) return <LoadingRows />;
  if (dashboard.isError) {
    return <p role="alert" className="text-sm text-destructive">{message(dashboard.error, "Could not load your dashboard.")}</p>;
  }

  const data = dashboard.data;
  if (!data) return <Empty>Nothing to show yet.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Today" value={data.counts.today} />
        <Stat label="Upcoming" value={data.counts.upcoming} />
        <Stat label="Pending" value={data.counts.pending} />
        <Stat label="Completed" value={data.counts.completed} />
        <Stat label="Cancelled" value={data.counts.cancelled} />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
          <CardDescription>Booked, completed and paid.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 text-right font-medium">Booked</th>
                <th className="pb-2 text-right font-medium">Completed</th>
                <th className="pb-2 text-right font-medium">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["All time", data.revenue.booked, data.revenue.completed, data.revenue.paid],
                ["Last 7 days", data.revenue.weekBooked, data.revenue.weekCompleted, data.revenue.weekPaid],
                ["Last 30 days", data.revenue.monthBooked, data.revenue.monthCompleted, data.revenue.monthPaid],
              ].map(([period, booked, completed, paid]) => (
                <tr key={String(period)}>
                  <td className="py-2 font-medium">{period}</td>
                  <td className="py-2 text-right tabular-nums">{formatPrice(Number(booked))}</td>
                  <td className="py-2 text-right tabular-nums">{formatPrice(Number(completed))}</td>
                  <td className="py-2 text-right tabular-nums">{formatPrice(Number(paid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
            <CardDescription>Average rating {data.rating.toFixed(1)}.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.reviews.length === 0 ? (
              <Empty>No reviews yet.</Empty>
            ) : (
              <ul className="space-y-4">
                {data.reviews.map((review) => (
                  <li key={review.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{review.member}</span>
                      <span className="text-sm tabular-nums">{review.rate}/5</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{review.note || "No note."}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{review.date}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <Empty>No activity yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {data.activity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>{item.text}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {item.when}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Next 14 days</CardTitle>
          <CardDescription>Day by day.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.calendar.map((day) => (
            <div key={day.date} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{formatDate(day.date)}</p>
                <StatusBadge label={`${day.total} booked`} />
              </div>
              {day.appointments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Open day.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {day.appointments.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="tabular-nums">{item.time}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {item.member} · {item.service}
                      </span>
                      <StatusBadge label={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
