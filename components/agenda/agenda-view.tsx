"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { addDays, formatDate, formatPrice, label } from "@/lib/domain/time";
import { STATUS_LABEL, type Role, type Status } from "@/lib/domain/types";

const badgeVariant: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  accepted: "secondary",
  booked: "default",
  done: "secondary",
  cancel: "outline",
  noshow: "destructive",
  rejected: "destructive",
};

export function AgendaView({ role }: { role: Role }) {
  const shopDate = useShopDate();
  const [chosenDate, setChosenDate] = useState("");
  const date = chosenDate || shopDate;
  const [barber, setBarber] = useState("");
  const barbers = useBarbers();
  const agenda = useAgenda(date, barber);
  const setStatus = useSetStatus();

  const bookings = agenda.data ?? [];
  const booked = bookings.filter((row) => row.status === "booked").length;
  const done = bookings.filter((row) => row.status === "done").length;
  const revenue = bookings
    .filter((row) => row.status === "done")
    .reduce((total, row) => total + row.price, 0);

  function close(id: string, status: Status) {
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`),
        onError: (error) =>
          toast.error("Could not update", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          }),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="agenda-date">Day</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Previous day"
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
              aria-label="Next day"
              disabled={!date}
              onClick={() => setChosenDate(addDays(date, 1))}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {role === "admin" ? (
          <div className="space-y-2">
            <Label htmlFor="agenda-barber">Barber</Label>
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
                <SelectItem value="all">All barbers</SelectItem>
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
          <Badge variant="secondary">{booked} booked</Badge>
          <Badge variant="outline">{done} done</Badge>
          <Badge variant="outline">{formatPrice(revenue)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {date ? formatDate(date) : "Pick a day"}
          </CardTitle>
          <CardDescription>
            {role === "barber" ? "Your chair for the day." : "Every chair for the day."}
          </CardDescription>
          {role === "barber" ? (
            <Link
              href="/agenda/me"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-3.5" aria-hidden />
              My chair settings
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {!date || agenda.isPending ? (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : agenda.isError ? (
            <p className="py-6 text-sm text-destructive">
              {agenda.error instanceof Error
                ? agenda.error.message
                : "Could not load the agenda."}
            </p>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No bookings</p>
              <p className="text-sm text-muted-foreground">
                The day is open.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium tabular-nums">
                      {label(booking.start)}–{label(booking.end)}
                    </TableCell>
                    <TableCell>{booking.userName ?? "Member"}</TableCell>
                    <TableCell>
                      {booking.serviceName}
                      <span className="text-muted-foreground">
                        {" "}
                        · {booking.barberName}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPrice(booking.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant[booking.status]}>
                        <T k={`status.${booking.status}`} />
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {booking.status === "pending" ? (
                          <>
                            <Button
                              size="xs"
                              disabled={setStatus.isPending}
                              onClick={() => close(booking.id, "accepted")}
                            >
                              Accept
                            </Button>
                            <Button
                              size="xs"
                              variant="destructive"
                              disabled={setStatus.isPending}
                              onClick={() => close(booking.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {booking.status === "accepted" || booking.status === "booked" ? (
                          <>
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={setStatus.isPending}
                            onClick={() => close(booking.id, "done")}
                          >
                            Done
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={setStatus.isPending}
                            onClick={() => close(booking.id, "noshow")}
                          >
                            No-show
                          </Button>
                          </>
                        ) : null}
                        {(booking.status === "pending" ||
                          booking.status === "accepted" ||
                          booking.status === "booked") ? (
                          <Button
                            size="xs"
                            variant="destructive"
                            disabled={setStatus.isPending}
                            onClick={() => close(booking.id, "cancel")}
                          >
                            {setStatus.isPending ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : null}
                            Cancel
                          </Button>
                        ) : null}
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
