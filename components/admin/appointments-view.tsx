"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  useAdminAppointmentDetail,
  useAdminAppointments,
  useAdminBarbers,
  useSetAppointmentStatus,
  type AppointmentFilter,
} from "@/lib/api/admin-queries";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/domain/types";

import {
  Empty,
  FormError,
  LoadingRows,
  Section,
  StatusBadge,
  message,
} from "./admin-ui";

export function AppointmentsView() {
  const [filter, setFilter] = useState<AppointmentFilter>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const list = useAdminAppointments(filter);
  const barbers = useAdminBarbers();
  const detail = useAdminAppointmentDetail(selectedId);
  const setStatus = useSetAppointmentStatus();

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const error =
    errorText ??
    (list.error ? message(list.error, "Could not load appointments.") : null) ??
    (detail.error ? message(detail.error, "Could not load the investigation.") : null);

  function changeStatus(id: string, status: Status) {
    setErrorText(null);
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Status set to ${STATUS_LABEL[status]}`),
        onError: (cause) => {
          setErrorText(message(cause, "Could not update the status."));
          toast.error("Could not update the status");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="All appointments"
        description="Filter by status, date or chair. Open a visit to investigate it."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="appt-status">Status</Label>
            <Select
              value={filter.status || "all"}
              onValueChange={(value) =>
                setFilter((current) => ({
                  ...current,
                  status: value === "all" ? undefined : String(value),
                }))
              }
            >
              <SelectTrigger id="appt-status" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-date">Date</Label>
            <div className="relative">
              <Input
                id="appt-date"
                type="date"
                value={filter.date ?? ""}
                onChange={(event) =>
                  setFilter((current) => ({
                    ...current,
                    date: event.target.value || undefined,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-barber">Chair</Label>
            <Select
              value={filter.barber || "all"}
              onValueChange={(value) =>
                setFilter((current) => ({
                  ...current,
                  barber: value === "all" ? undefined : String(value),
                }))
              }
            >
              <SelectTrigger id="appt-barber" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chairs</SelectItem>
                {(barbers.data ?? []).map((barber) => (
                  <SelectItem key={barber.id} value={barber.id}>
                    {barber.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <FormError text={error} />

        {list.isPending ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <Empty>No appointments match these filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Chair</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((booking) => (
                  <TableRow
                    key={booking.id}
                    className={selectedId === booking.id ? "bg-muted/50" : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(booking.date)}
                      <span className="block text-xs text-muted-foreground">
                        {label(booking.start)}–{label(booking.end)}
                      </span>
                    </TableCell>
                    <TableCell>{booking.userName || "Member"}</TableCell>
                    <TableCell>{booking.barberName}</TableCell>
                    <TableCell>{booking.serviceName}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatPrice(booking.price)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Select
                          value={booking.status}
                          disabled={setStatus.isPending}
                          onValueChange={(value) =>
                            changeStatus(booking.id, String(value) as Status)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Status for booking ${booking.id}`}
                            className="h-8 w-32"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_LABEL[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            setSelectedId(selectedId === booking.id ? null : booking.id)
                          }
                        >
                          {selectedId === booking.id ? "Close" : "Investigate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {selectedId ? (
        <Section
          title="Dispute investigation"
          description="Booking note, review, payments and the member's history."
        >
          {detail.isPending ? (
            <LoadingRows />
          ) : detail.isError || !detail.data ? (
            <FormError text={message(detail.error, "Could not load this appointment.")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Booking id" value={detail.data.booking.id} />
              <Detail label="Member" value={detail.data.booking.userName || "Member"} />
              <Detail label="Chair" value={detail.data.booking.barberName} />
              <Detail label="Service" value={detail.data.booking.serviceName} />
              <Detail
                label="When"
                value={`${detail.data.booking.date} ${label(detail.data.booking.start)}–${label(detail.data.booking.end)}`}
              />
              <Detail label="Status" value={STATUS_LABEL[detail.data.booking.status]} />
              <Detail label="Price" value={formatPrice(detail.data.booking.price)} />
              <Detail
                label="Member note"
                value={detail.data.booking.note || "None"}
              />
              <Detail
                label="Review"
                value={
                  detail.data.review
                    ? `${detail.data.review.rate} / 5 — ${detail.data.review.note || "No note"}`
                    : "No review"
                }
              />
              <Detail
                label="Payments"
                value={
                  detail.data.payments.length > 0
                    ? detail.data.payments
                        .map(
                          (payment) =>
                            `${formatPrice(payment.amount)} · ${payment.status} · ${payment.method}`,
                        )
                        .join("; ")
                    : "No payment records"
                }
              />
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Member history ({detail.data.history.length})
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.data.history.slice(0, 8).map((row) => (
                    <li key={row.id} className="flex justify-between gap-4">
                      <span>
                        {row.date} · {row.barberName} · {row.serviceName}
                      </span>
                      <Badge variant="outline">{STATUS_LABEL[row.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Section>
      ) : null}
    </div>
  );
}

function Detail({ label: name, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{name}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}
