"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useBarberCustomer,
  useBarberCustomers,
  useSaveBarberNote,
  type BookingRow,
  type CustomerDetail,
} from "@/lib/api/barber-queries";
import { formatDate, formatPrice, label } from "@/lib/domain/time";

import {
  Empty,
  FormError,
  LoadingRows,
  message,
  StatusBadge,
} from "./barber-ui";

function NoteForm({ detail }: { detail: CustomerDetail }) {
  const save = useSaveBarberNote();
  const t = useT();
  const [note, setNote] = useState(detail.note);
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    save.mutate(
      { client: detail.id, note },
      {
        onSuccess: () => toast.success(t("work.customers.noteSaved")),
        onError: (error) => {
          const text = message(error, t("work.toast.failed"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="customer-note">
        <T k="common.note" />
      </Label>
      <Textarea
        id="customer-note"
        value={note}
        maxLength={512}
        placeholder={t("work.customers.noteHint")}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        <T k="work.customers.notePrivate" />
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? (
            <T k="common.loading" />
          ) : (
            <T k="work.customers.saveNote" />
          )}
        </Button>
        <FormError text={formError} />
      </div>
    </form>
  );
}

type HistoryRow = {
  id: string;
  date: string;
  time: string;
  service: string;
  status: BookingRow["status"];
  price: number;
};

/** Accept both the enriched booking rows and the compact history view. */
function historyOf(detail: CustomerDetail): HistoryRow[] {
  const raw = detail as unknown as {
    visits?: unknown;
    bookings?: unknown;
  };
  const source = Array.isArray(raw.visits) ? raw.visits : raw.bookings;
  if (!Array.isArray(source)) return [];

  return (source as BookingRow[]).map((row) => {
    const compact = row as unknown as { time?: string; service?: string };
    return {
      id: row.id,
      date: row.date,
      time: compact.time || label(row.start),
      service: compact.service || row.serviceName || "—",
      status: row.status,
      price: row.price,
    };
  });
}

function Detail({ detail }: { detail: CustomerDetail }) {
  const t = useT();
  const rows = historyOf(detail);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <T k="work.customers.visits" />
          </p>
          <p className="text-lg font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <T k="work.customers.last" />
          </p>
          <p className="text-lg font-semibold">
            {detail.last ? formatDate(detail.last) : "—"}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty>{t("work.customers.noVisits")}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T k="common.date" />
                </TableHead>
                <TableHead>
                  <T k="common.time" />
                </TableHead>
                <TableHead>
                  <T k="work.customers.service" />
                </TableHead>
                <TableHead>
                  <T k="common.status" />
                </TableHead>
                <TableHead className="text-right">
                  <T k="common.price" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    {formatDate(booking.date)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {booking.time}
                  </TableCell>
                  <TableCell>{booking.service}</TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(booking.price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NoteForm key={`${detail.id}-${detail.note}`} detail={detail} />
    </div>
  );
}

export function BarberCustomers() {
  const customers = useBarberCustomers();
  const t = useT();
  const [selected, setSelected] = useState("");
  const detail = useBarberCustomer(selected);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.customers.title" />
          </CardTitle>
          <CardDescription>
            <T k="work.customers.hint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {customers.isPending ? (
            <LoadingRows />
          ) : customers.isError ? (
            <FormError text={message(customers.error, t("work.loadError"))} />
          ) : !customers.data || customers.data.length === 0 ? (
            <Empty>{t("work.customers.empty")}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.member" />
                  </TableHead>
                  <TableHead>
                    <T k="common.phone" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="work.customers.visits" />
                  </TableHead>
                  <TableHead>
                    <T k="work.customers.last" />
                  </TableHead>
                  <TableHead className="max-w-52">
                    <T k="common.note" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="work.agenda.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.data.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.phone || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {customer.visits}
                    </TableCell>
                    <TableCell>
                      {customer.last ? formatDate(customer.last) : "—"}
                    </TableCell>
                    <TableCell className="max-w-52 truncate text-muted-foreground">
                      {customer.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          selected === customer.id ? "default" : "outline"
                        }
                        onClick={() =>
                          setSelected(
                            selected === customer.id ? "" : customer.id,
                          )
                        }
                      >
                        <T
                          k={
                            selected === customer.id
                              ? "common.close"
                              : "work.customers.history"
                          }
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>
              {detail.data?.name ?? t("common.member")}
            </CardTitle>
            <CardDescription>
              <T k="work.customers.detailHint" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.isPending ? (
              <LoadingRows />
            ) : detail.isError ? (
              <FormError text={message(detail.error, t("work.loadError"))} />
            ) : detail.data ? (
              <Detail detail={detail.data} />
            ) : (
              <Empty>{t("work.customers.noVisits")}</Empty>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
