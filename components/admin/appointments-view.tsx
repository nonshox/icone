"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminAppointmentDetail,
  useAdminAppointments,
  useAdminBarbers,
  useSetAppointmentStatus,
  type AppointmentFilter,
  type BookingDetail,
} from "@/lib/api/admin-queries";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import { STATUSES, type BookingRow, type Status } from "@/lib/domain/types";

import {
  Empty,
  FormError,
  LoadingRows,
  Section,
  StatusBadge,
  message,
} from "./admin-ui";

type Investigation = {
  booking: BookingRow;
  review?: { rate: number; note: string } | null;
  history?: BookingRow[];
};

export function AppointmentsView() {
  const t = useT();
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
    (list.error ? message(list.error, t("admin.loadError")) : null) ??
    (detail.error ? message(detail.error, t("admin.loadError")) : null);

  function changeStatus(id: string, status: Status) {
    setErrorText(null);
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(t("admin.statusUpdated")),
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Section title={<T k="admin.appointments.title" />} description={<T k="admin.filterHint" />}>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="appt-status"><T k="common.status" /></Label>
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
                <SelectItem value="all"><T k="admin.allStatuses" /></SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`).startsWith("status.")
                      ? status
                      : t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-date"><T k="common.date" /></Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="appt-barber"><T k="admin.chair" /></Label>
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
                <SelectItem value="all"><T k="admin.allChairs" /></SelectItem>
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
          <Empty><T k="admin.emptyFilter" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.date" /></TableHead>
                  <TableHead><T k="common.member" /></TableHead>
                  <TableHead><T k="admin.chair" /></TableHead>
                  <TableHead><T k="admin.service" /></TableHead>
                  <TableHead><T k="common.price" /></TableHead>
                  <TableHead><T k="common.status" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
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
                    <TableCell>{booking.customerName || booking.user || "—"}</TableCell>
                    <TableCell>{booking.barberName || "—"}</TableCell>
                    <TableCell>{booking.serviceName || "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatPrice(booking.price)}</TableCell>
                    <TableCell><StatusBadge status={booking.status} /></TableCell>
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
                            aria-label={`${t("common.status")}: ${booking.id}`}
                            className="h-8 w-32"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {t(`status.${status}`).startsWith("status.")
                                  ? status
                                  : t(`status.${status}`)}
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
                          {selectedId === booking.id ? <T k="common.close" /> : <T k="admin.investigate" />}
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
        <Section title={<T k="admin.investigation" />}>
          {detail.isPending ? (
            <LoadingRows />
          ) : detail.isError || !detail.data ? (
            <FormError text={message(detail.error, t("admin.loadError"))} />
          ) : (
            <InvestigationDetail detail={detail.data} />
          )}
        </Section>
      ) : null}
    </div>
  );
}

function InvestigationDetail({ detail }: { detail: BookingDetail }) {
  const t = useT();
  const data = detail as unknown as Investigation;
  const booking = data.booking;
  const history = data.history ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Detail label={<T k="admin.bookingId" />} value={booking.id} />
      <Detail label={<T k="common.member" />} value={booking.customerName || booking.user || "—"} />
      <Detail label={<T k="admin.chair" />} value={booking.barberName || "—"} />
      <Detail label={<T k="admin.service" />} value={booking.serviceName || "—"} />
      <Detail
        label={<T k="admin.when" />}
        value={`${booking.date} ${label(booking.start)}–${label(booking.end)}`}
      />
      <Detail label={<T k="common.status" />} value={booking.status} />
      <Detail label={<T k="common.price" />} value={formatPrice(booking.price)} />
      <Detail label={<T k="admin.memberNote" />} value={booking.note || "—"} />
      <Detail
        label={<T k="admin.review" />}
        value={
          data.review
            ? `${data.review.rate}/5 — ${data.review.note || "—"}`
            : t("admin.noReview")
        }
      />
      <div className="sm:col-span-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <T k="common.history" /> ({history.length})
        </p>
        {history.length === 0 ? (
          <Empty><T k="common.noData" /></Empty>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {row.date} · {row.barberName} · {row.serviceName}
                </span>
                <Badge variant="outline">{row.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Detail({ label: name, value }: { label: ReactNode; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{name}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}
