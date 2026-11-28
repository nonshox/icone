"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBarberDashboard, useBarberSettings } from "@/lib/api/barber-queries";
import { useAgenda, useSetStatus } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { useT } from "@/lib/i18n/use-t";
import { addDays, formatDate, label, shopClock } from "@/lib/domain/time";
import type { BookingRow, Status } from "@/lib/domain/types";

import {
  EmptyState,
  ErrorState,
  LoadingRows,
  message,
} from "@/components/ui/app-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

const LINKS = [
  { href: "/agenda", key: "nav.agenda" },
  { href: "/barber/services", key: "nav.services" },
  { href: "/barber/customers", key: "nav.myVisits" },
  { href: "/barber/portfolio", key: "nav.profile" },
  { href: "/barber/notifications", key: "nav.inbox" },
  { href: "/agenda/me", key: "work.staff.toDashboard" },
  { href: "/api/barber/export?range=month", key: "work.export" },
];

/** Only the transitions the domain actually accepts. */
const NEXT: Record<Status, Status[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["done", "noshow", "cancelled"],
  rejected: [],
  cancelled: [],
  done: [],
  noshow: [],
};

const linkClass =
  "inline-flex items-center rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground";

/** A real booking that still holds a slot. */
function isOpen(row: BookingRow): boolean {
  return row.status === "pending" || row.status === "confirmed";
}

/* ------------------------------------------------------------- shop clock */

const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};

type Clock = { date: string; minutes: number };

let cachedClock: Clock | null = null;
function getClock(): Clock {
  const now = shopClock();
  if (
    !cachedClock ||
    cachedClock.date !== now.date ||
    cachedClock.minutes !== now.minutes
  ) {
    cachedClock = now;
  }
  return cachedClock;
}
const serverClock = (): Clock | null => null;

/** Shop time in the browser; nothing clock-based is rendered on the server. */
function useShopNow() {
  return useSyncExternalStore<Clock | null>(subscribe, getClock, serverClock);
}

/* -------------------------------------------------------------- building blocks */

function actionLabel(target: Status, t: (key: string) => string): string {
  switch (target) {
    case "confirmed":
      return t("work.agenda.accept");
    case "rejected":
      return t("work.agenda.reject");
    case "cancelled":
      return t("work.agenda.cancel");
    case "done":
      return t("work.agenda.done");
    case "noshow":
      return t("work.agenda.noshow");
    default:
      return t(`status.${target}`);
  }
}

function StatusActions({
  booking,
  busy,
  onChange,
}: {
  booking: BookingRow;
  busy: boolean;
  onChange: (id: string, status: Status) => void;
}) {
  const t = useT();
  const targets = NEXT[booking.status];

  if (targets.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 sm:justify-end">
      {targets.map((target) => (
        <Button
          key={target}
          type="button"
          size="xs"
          variant={
            target === "rejected" ||
            target === "cancelled" ||
            target === "noshow"
              ? "destructive"
              : target === "done"
                ? "secondary"
                : "outline"
          }
          disabled={busy}
          onClick={() => onChange(booking.id, target)}
        >
          {actionLabel(target, t)}
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
        </Button>
      ))}
    </div>
  );
}

function BookingRowView({
  booking,
  busy,
  onChange,
}: {
  booking: BookingRow;
  busy: boolean;
  onChange: (id: string, status: Status) => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{booking.customerName}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {booking.serviceName || "—"}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {label(booking.start)}–{label(booking.end)}
        </p>
      </div>
      <StatusActions booking={booking} busy={busy} onChange={onChange} />
    </li>
  );
}

/* ------------------------------------------------------------------ panels */

function TodayPanel({
  bookings,
  isPending,
  isError,
  busy,
  onChange,
}: {
  bookings: BookingRow[];
  isPending: boolean;
  isError: boolean;
  busy: boolean;
  onChange: (id: string, status: Status) => void;
}) {
  const t = useT();

  return (
    <Card className="glass lg:col-span-2">
      <CardHeader>
        <CardTitle>
          <T k="work.dashboard.todayTitle" />
        </CardTitle>
        <CardDescription>
          <T k="work.dashboard.todayHint" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState fallback={t("work.agenda.loadError")} />
        ) : bookings.length === 0 ? (
          <EmptyState>{t("work.agenda.noBookings")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <BookingRowView
                key={booking.id}
                booking={booking}
                busy={busy}
                onChange={onChange}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PendingPanel({
  bookings,
  isPending,
  isError,
  busy,
  onChange,
}: {
  bookings: BookingRow[];
  isPending: boolean;
  isError: boolean;
  busy: boolean;
  onChange: (id: string, status: Status) => void;
}) {
  const t = useT();

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.dashboard.pendingTitle" />
        </CardTitle>
        <CardDescription>
          <T k="work.dashboard.pendingHint" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState fallback={t("work.agenda.loadError")} />
        ) : bookings.length === 0 ? (
          <EmptyState>{t("work.dashboard.allCaughtUp")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <BookingRowView
                key={booking.id}
                booking={booking}
                busy={busy}
                onChange={onChange}
              />
            ))}
          </ul>
        )}
        <Link href="/agenda" className={linkClass}>
          <T k="work.dashboard.viewAgenda" />
        </Link>
      </CardContent>
    </Card>
  );
}

function NextPanel({
  booking,
  today,
  isPending,
  isError,
}: {
  booking: BookingRow | null;
  today: string;
  isPending: boolean;
  isError: boolean;
}) {
  const t = useT();
  const when = booking
    ? booking.date === today
      ? t("common.today")
      : booking.date === addDays(today, 1)
        ? t("work.dashboard.tomorrow")
        : formatDate(booking.date)
    : "";

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.dashboard.nextTitle" />
        </CardTitle>
        <CardDescription>
          <T k="work.dashboard.nextHint" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState fallback={t("work.agenda.loadError")} />
        ) : !booking ? (
          <EmptyState>{t("work.dashboard.nextEmpty")}</EmptyState>
        ) : (
          <div className="space-y-1.5">
            <p className="text-lg font-semibold tabular-nums">
              {label(booking.start)}–{label(booking.end)}
            </p>
            <p className="text-sm text-muted-foreground">{when}</p>
            <p className="font-medium">{booking.customerName}</p>
            <p className="text-sm text-muted-foreground">
              {booking.serviceName || "—"}
            </p>
            <StatusBadge status={booking.status} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkspacePanel() {
  const settings = useBarberSettings();
  const t = useT();
  const profile = settings.data?.barber;
  const place = [profile?.city, profile?.address].filter(Boolean).join(", ");

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.dashboard.locationTitle" />
        </CardTitle>
        <CardDescription>
          <T k="work.dashboard.locationHint" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.isPending ? (
          <LoadingRows />
        ) : settings.isError ? (
          <ErrorState
            error={settings.error}
            fallback={t("work.loadError")}
          />
        ) : !profile ? (
          <EmptyState>{t("work.dashboard.locationEmpty")}</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{profile.name}</span>
              <Badge variant={profile.active ? "secondary" : "outline"}>
                <T k={profile.active ? "common.open" : "work.services.hidden"} />
              </Badge>
            </div>
            {place ? (
              <p className="text-sm text-muted-foreground">{place}</p>
            ) : null}
            {profile.phone ? (
              <p className="text-sm text-muted-foreground">{profile.phone}</p>
            ) : null}
            <Link href="/barber/settings" className={linkClass}>
              <T k="work.dashboard.editProfile" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ screen */

export function BarberDashboard() {
  const dashboard = useBarberDashboard();
  const t = useT();
  const today = useShopDate();
  const now = useShopNow();
  const agenda = useAgenda(today);
  const tomorrow = useAgenda(today ? addDays(today, 1) : "");
  const setStatus = useSetStatus();

  function change(id: string, status: Status) {
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(
            `${t("work.agenda.toastStatus")}: ${t(`status.${status}`)}`,
          ),
        onError: (error) =>
          toast.error(t("work.toast.failed"), {
            description: message(error, t("common.tryAgain")),
          }),
      },
    );
  }

  if (dashboard.isPending) return <LoadingRows />;
  if (dashboard.isError) {
    return (
      <ErrorState error={dashboard.error} fallback={t("work.loadError")} />
    );
  }

  const data = dashboard.data;
  if (!data) return <EmptyState>{t("work.loadError")}</EmptyState>;

  const quiet =
    data.today + data.upcoming + data.pending + data.completed === 0;

  const sorted = [...(agenda.data ?? [])].sort((a, b) => a.start - b.start);
  const pending = sorted.filter((row) => row.status === "pending");
  const upcoming = now
    ? sorted.filter((row) => isOpen(row) && row.end > now.minutes)
    : sorted.filter(isOpen);
  const next =
    upcoming[0] ??
    [...(tomorrow.data ?? [])].filter(isOpen).sort((a, b) => a.start - b.start)[0] ??
    null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("common.today")} value={data.today} />
        <StatCard label={t("common.upcoming")} value={data.upcoming} />
        <StatCard label={t("work.stat.pending")} value={data.pending} />
        <StatCard label={t("common.completed")} value={data.completed} />
        <StatCard label={t("work.stat.clients")} value={data.clients} />
        <StatCard label={t("work.stat.returning")} value={data.returning} />
        <StatCard
          label={t("work.stat.rating")}
          value={data.rating > 0 ? data.rating.toFixed(1) : "—"}
        />
        <StatCard label={t("work.stat.views")} value={data.views} />
      </div>

      {quiet ? <EmptyState>{t("work.dashboard.empty")}</EmptyState> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayPanel
          bookings={sorted}
          isPending={agenda.isPending}
          isError={agenda.isError}
          busy={setStatus.isPending}
          onChange={change}
        />
        <div className="space-y-4">
          <NextPanel
            booking={next}
            today={today}
            isPending={agenda.isPending}
            isError={agenda.isError && !tomorrow.data}
          />
          <WorkspacePanel />
        </div>
      </div>

      <PendingPanel
        bookings={pending}
        isPending={agenda.isPending}
        isError={agenda.isError}
        busy={setStatus.isPending}
        onChange={change}
      />

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.dashboard.quick" />
          </CardTitle>
          <CardDescription>
            <T k="work.dashboard.quickHint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LINKS.map((item) => {
            // API downloads need a real navigation, not a client-side route push.
            return item.href.startsWith("/api/") ? (
              <a key={item.href} href={item.href} download className={linkClass}>
                <T k={item.key} />
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={linkClass}>
                <T k={item.key} />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
