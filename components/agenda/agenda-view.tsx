"use client";

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
import { addDays, formatDate, label } from "@/lib/domain/time";
import type { Role, Status } from "@/lib/domain/types";

const badgeVariant: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  confirmed: "default",
  rejected: "destructive",
  cancelled: "outline",
  done: "secondary",
  noshow: "destructive",
};

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

export function AgendaView({ role }: { role: Role }) {
  const shopDate = useShopDate();
  const [chosenDate, setChosenDate] = useState("");
  const date = chosenDate || shopDate;
  const [barber, setBarber] = useState("");
  const barbers = useBarbers();
  const agenda = useAgenda(date, barber);
  const setStatus = useSetStatus();
  const t = useT();

  const bookings = agenda.data ?? [];
  const pending = bookings.filter((row) => row.status === "pending").length;
  const confirmed = bookings.filter((row) => row.status === "confirmed").length;
  const done = bookings.filter((row) => row.status === "done").length;

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
              aria-label={t("work.agenda.prevDay")}
              disabled={!date}
              onClick={() => setChosenDate(addDays(date, -1))}
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
              aria-label={t("work.agenda.nextDay")}
              disabled={!date}
              onClick={() => setChosenDate(addDays(date, 1))}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {role === "admin" ? (
          <div className="space-y-2">
            <Label htmlFor="agenda-barber">
              <T k="booking.barber" />
            </Label>
            <Select
              value={barber || "all"}
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
          <CardTitle>
            {date ? formatDate(date) : t("work.agenda.pickDay")}
          </CardTitle>
          <CardDescription>
            <T
              k={
                role === "barber"
                  ? "work.agenda.forChair"
                  : "work.agenda.forAll"
              }
            />
          </CardDescription>
          {role === "barber" ? (
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
                      <span className="font-medium">
                        {booking.customerName}
                      </span>
                      {booking.customerPhone ? (
                        <span className="block text-xs text-muted-foreground">
                          {booking.customerPhone}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {booking.serviceName || "—"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {booking.barberName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant[booking.status]}>
                        <T k={`status.${booking.status}`} />
                      </Badge>
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
                            {target === "confirmed" ||
                            target === "done" ? (
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
