"use client";

import { cn } from "cn";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
import { useAgenda, useBarbers, useSetStatus } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { addDays, formatDate, label, weekday } from "@/lib/domain/time";
import type { Role, Status } from "@/lib/domain/types";

/** Only the transitions the domain actually accepts. */
const NEXT: Record<Status, Status[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["done", "noshow", "cancelled"],
  rejected: [],
  cancelled: [],
  done: [],
  noshow: [],
};

const ACTION_KEY: Record<Status, string> = {
  pending: "work.agenda.accept",
  confirmed: "work.agenda.done",
  rejected: "",
  cancelled: "",
  done: "",
  noshow: "",
};

type View = "day" | "week" | "month";

const VIEWS: ReadonlyArray<{ id: View; key: string }> = [
  { id: "day", key: "work.agenda.view.day" },
  { id: "week", key: "work.agenda.view.week" },
  { id: "month", key: "work.agenda.view.month" },
];

/* ------------------------------------------------------------ date helpers */

/** Monday-based first day of the week containing `date`. */
function mondayOf(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(date: string, delta: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + delta;
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function daysInMonth(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthKey(date: string): string {
  return `work.agenda.month.${Number(date.slice(5, 7))}`;
}

/* -------------------------------------------------------------- grid cells */

function DayCell({
  date,
  barber,
  selected,
  today,
  outside,
  compact,
  onSelect,
}: {
  date: string;
  barber: string;
  selected: boolean;
  today: string;
  outside: boolean;
  compact: boolean;
  onSelect: (date: string) => void;
}) {
  const agenda = useAgenda(outside ? "" : date, barber);
  const t = useT();
  const bookings = agenda.data ?? [];
  const count = bookings.length;
  const pending = bookings.filter((row) => row.status === "pending").length;
  const day = Number(date.slice(8, 10));

  const ariaLabel = outside
    ? ""
    : `${t("work.agenda.selectDay")} ${formatDate(date)}. ${t("work.agenda.bookings")}: ${count}`;

  if (outside) {
    return (
      <div
        aria-hidden
        className={cn(
          compact
            ? "aspect-square rounded-lg border border-transparent"
            : "min-h-20 rounded-xl border border-transparent",
        )}
      />
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-pressed={selected}
        onClick={() => onSelect(date)}
        className={cn(
          "relative aspect-square rounded-lg border border-border text-left transition-colors hover:bg-brand/10",
          selected && "border-brand/60 bg-brand/10",
          date === today && "ring-1 ring-brand/40",
        )}
      >
        <span className="absolute left-1 top-0.5 text-xs tabular-nums">{day}</span>
        {agenda.isPending ? (
          <Loader2
            className="absolute bottom-1 right-1 size-3 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : agenda.isError ? (
          <span
            title={t("work.agenda.dayError")}
            className="absolute bottom-1 right-1 text-xs text-destructive"
          >
            !
          </span>
        ) : count > 0 ? (
          <span className="absolute bottom-1 right-1 min-w-4 rounded bg-brand/15 px-0.5 text-center text-[10px] font-medium tabular-nums text-brand-strong">
            {count}
          </span>
        ) : null}
        {pending > 0 ? (
          <span
            aria-hidden
            className="absolute bottom-1 left-1 size-1.5 rounded-full bg-brand"
          />
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-pressed={selected}
      onClick={() => onSelect(date)}
      className={cn(
        "flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2 text-center transition-colors hover:bg-brand/10",
        selected && "border-brand/60 bg-brand/10",
        date === today && "ring-1 ring-brand/40",
      )}
    >
      <span className="w-full truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        <T k={`day.${weekday(date)}`} />
      </span>
      <span className="text-lg font-semibold tabular-nums">{day}</span>
      {agenda.isPending ? (
        <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
      ) : agenda.isError ? (
        <span title={t("work.agenda.dayError")} className="text-xs text-destructive">
          !
        </span>
      ) : (
        <span className="text-xs text-muted-foreground tabular-nums">
          {count > 0 ? count : "—"}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ screen */

export function AgendaView({
  role,
  canPickBarber = false,
  ownBarberId = "",
}: {
  role: Role;
  canPickBarber?: boolean;
  ownBarberId?: string;
}) {
  const shopDate = useShopDate();
  const [chosenDate, setChosenDate] = useState("");
  const date = chosenDate || shopDate;
  const [view, setView] = useState<View>("day");
  const [barber, setBarber] = useState("");
  const barbers = useBarbers();
  const setStatus = useSetStatus();
  const t = useT();

  const ownChair = Boolean(ownBarberId);
  const firstBarber = barbers.data?.[0]?.id ?? "";
  // A staff account promoted to "barber" may own no chair at all. The API
  // needs an explicit barber id for those accounts, so pick a real one.
  const barberFilter =
    barber ||
    ownBarberId ||
    (role !== "admin" && canPickBarber ? firstBarber : "");
  const needsBarberFilter = role !== "admin" && canPickBarber && !ownBarberId;
  // Don't ask for an unscoped calendar before we can name a real barber.
  const agendaDate = needsBarberFilter && barbers.isPending ? "" : date;

  const agenda = useAgenda(agendaDate, barberFilter);
  const bookings = agenda.data ?? [];
  const pending = bookings.filter((row) => row.status === "pending").length;
  const confirmed = bookings.filter((row) => row.status === "confirmed").length;
  const done = bookings.filter((row) => row.status === "done").length;

  const weekStart = date ? mondayOf(date) : "";
  const weekDays = weekStart
    ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    : [];
  const monthCells = date
    ? (() => {
        const first = firstOfMonth(date);
        const start = mondayOf(first);
        const count = Math.ceil(
          ((weekday(first) + 6) % 7 + daysInMonth(first)) / 7,
        ) * 7;
        return Array.from({ length: count }, (_, index) => addDays(start, index));
      })()
    : [];

  function selectDay(value: string) {
    setChosenDate(value);
    setView("day");
  }

  function shift(delta: number) {
    if (!date) return;
    if (view === "week") {
      setChosenDate(addDays(mondayOf(date), delta * 7));
    } else if (view === "month") {
      setChosenDate(shiftMonth(firstOfMonth(date), delta));
    } else {
      setChosenDate(addDays(date, delta));
    }
  }

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
            description:
              error instanceof Error ? error.message : t("common.tryAgain"),
          }),
      },
    );
  }

  const heading = !date
    ? t("work.agenda.pickDay")
    : view === "day"
      ? formatDate(date)
      : view === "week"
        ? `${t("work.agenda.weekOf")} ${weekStart.slice(8)}–${addDays(weekStart, 6).slice(8)} ${t(monthKey(addDays(weekStart, 6)))} ${addDays(weekStart, 6).slice(0, 4)}`
        : `${t(monthKey(date))} ${date.slice(0, 4)}`;

  const hint =
    view === "week"
      ? t("work.agenda.weekHint")
      : view === "month"
        ? t("work.agenda.monthHint")
        : t(ownChair ? "work.agenda.forChair" : "work.agenda.forAll");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="agenda-date">
            <T k="common.date" />
          </Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`${t("work.agenda.prev")} ${t(`work.agenda.view.${view}`)}`}
              disabled={!date}
              onClick={() => shift(-1)}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </Button>
            <Input
              id="agenda-date"
              type="date"
              value={date}
              onChange={(event) => setChosenDate(event.target.value)}
              className="h-9 w-40"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`${t("work.agenda.next")} ${t(`work.agenda.view.${view}`)}`}
              disabled={!date}
              onClick={() => shift(1)}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {canPickBarber ? (
          <div className="space-y-2">
            <Label htmlFor="agenda-barber">
              <T k="booking.barber" />
            </Label>
            <Select
              value={barber || ownBarberId || "all"}
              onValueChange={(value) =>
                setBarber(value === "all" ? "" : String(value))
              }
            >
              <SelectTrigger id="agenda-barber" className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <T k="work.agenda.allBarbers" />
                </SelectItem>
                {(barbers.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div
          role="group"
          aria-label={t("work.agenda.viewLabel")}
          className="flex flex-wrap gap-1"
        >
          {VIEWS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={view === item.id ? "default" : "outline"}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              <T k={item.key} />
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Badge variant="outline">
            {pending} <T k="status.pending" />
          </Badge>
          <Badge variant="secondary">
            {confirmed} <T k="status.confirmed" />
          </Badge>
          <Badge variant="outline">
            {done} <T k="status.done" />
          </Badge>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{hint}</CardDescription>
          {ownChair ? (
            <Link
              href="/agenda/me"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-3.5" aria-hidden />
              <T k="work.agenda.chairSettings" />
            </Link>
          ) : null}
          <Link
            href="/agenda/walkin"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <T k="nav.appointments" /> · <T k="common.add" />
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!date || agenda.isPending ? (
            <div className="space-y-2 py-2" aria-hidden>
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ) : view === "week" ? (
            <div className="grid min-w-[720px] grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <DayCell
                  key={day}
                  date={day}
                  barber={barberFilter}
                  selected={day === (chosenDate || shopDate)}
                  today={shopDate}
                  outside={false}
                  compact={false}
                  onSelect={selectDay}
                />
              ))}
            </div>
          ) : view === "month" ? (
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, index) => {
                  const name = t(`day.${(index + 1) % 7}`);
                  return (
                    <div
                      key={index}
                      title={name}
                      className="truncate text-center text-[10px] uppercase tracking-wide text-muted-foreground"
                    >
                      {name.slice(0, 2)}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((day) => (
                  <DayCell
                    key={day}
                    date={day}
                    barber={barberFilter}
                    selected={day === (chosenDate || shopDate)}
                    today={shopDate}
                    outside={day.slice(0, 7) !== date.slice(0, 7)}
                    compact
                    onSelect={selectDay}
                  />
                ))}
              </div>
            </div>
          ) : agenda.isError ? (
            <p role="alert" className="py-6 text-sm text-destructive">
              {agenda.error instanceof Error
                ? agenda.error.message
                : t("work.agenda.loadError")}
            </p>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">
                <T k="work.agenda.noBookings" />
              </p>
              <p className="text-sm text-muted-foreground">
                <T k="work.agenda.dayOpen" />
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.time" />
                  </TableHead>
                  <TableHead>
                    <T k="common.member" />
                  </TableHead>
                  <TableHead>
                    <T k="booking.service" />
                  </TableHead>
                  <TableHead>
                    <T k="common.status" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="work.agenda.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium tabular-nums">
                      {label(booking.start)}–{label(booking.end)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{booking.customerName}</span>
                      {booking.customerPhone ? (
                        <span className="block text-xs text-muted-foreground">
                          {booking.customerPhone}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {booking.serviceName || "—"}
                      <span className="text-muted-foreground">
                        {" "}· {booking.barberName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {NEXT[booking.status].map((target) => (
                          <Button
                            key={target}
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
                            disabled={setStatus.isPending}
                            onClick={() => change(booking.id, target)}
                          >
                            {target === "confirmed" || target === "done" ? (
                              <T k={ACTION_KEY[target]} />
                            ) : target === "rejected" ? (
                              <T k="work.agenda.reject" />
                            ) : target === "cancelled" ? (
                              <T k="work.agenda.cancel" />
                            ) : (
                              <T k="work.agenda.noshow" />
                            )}
                            {setStatus.isPending ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : null}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
