"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  type CustomerDetail,
} from "@/lib/api/barber-queries";
import { formatDate, formatPrice } from "@/lib/domain/time";

import { Empty, FormError, LoadingRows, message, StatusBadge } from "./barber-ui";

function NoteForm({ detail }: { detail: CustomerDetail }) {
  const save = useSaveBarberNote();
  const [note, setNote] = useState(detail.customer.note);
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    save.mutate(
      { userId: detail.customer.id, note },
      {
        onSuccess: () => toast.success("Private note saved"),
        onError: (error) => {
          setFormError(message(error, "Could not save the note."));
          toast.error("Could not save the note");
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="customer-note">Private note</Label>
      <Textarea
        id="customer-note"
        value={note}
        maxLength={512}
        placeholder="Preferences worth keeping."
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Only you can see this.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save note"}
        </Button>
        <FormError text={formError} />
      </div>
    </form>
  );
}

function Detail({ detail }: { detail: CustomerDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Visits</p>
          <p className="text-lg font-semibold tabular-nums">{detail.customer.visits}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completed</p>
          <p className="text-lg font-semibold tabular-nums">{detail.customer.completed}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Spend</p>
          <p className="text-lg font-semibold tabular-nums">{formatPrice(detail.customer.spend)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last visit</p>
          <p className="text-lg font-semibold">{detail.customer.last ? formatDate(detail.customer.last) : "—"}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{formatDate(booking.date)}</TableCell>
                <TableCell className="tabular-nums">{booking.time}</TableCell>
                <TableCell>{booking.service}</TableCell>
                <TableCell><StatusBadge label={booking.status} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatPrice(booking.price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NoteForm key={`${detail.customer.id}-${detail.customer.note}`} detail={detail} />
    </div>
  );
}

export function BarberCustomers() {
  const customers = useBarberCustomers();
  const [selected, setSelected] = useState("");
  const detail = useBarberCustomer(selected);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Members and private notes.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {customers.isPending ? (
            <LoadingRows />
          ) : customers.isError ? (
            <FormError text={message(customers.error, "Could not load your customers.")} />
          ) : !customers.data || customers.data.length === 0 ? (
            <Empty>No customers yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.data.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.phone || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{customer.visits}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(customer.spend)}</TableCell>
                    <TableCell>{customer.last ? formatDate(customer.last) : "—"}</TableCell>
                    <TableCell className="max-w-52 truncate text-muted-foreground">
                      {customer.services.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={selected === customer.id ? "default" : "outline"}
                        onClick={() => setSelected(selected === customer.id ? "" : customer.id)}
                      >
                        {selected === customer.id ? "Close" : "History"}
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
            <CardTitle>{detail.data?.customer.name ?? "Member"}</CardTitle>
            <CardDescription>History and your note.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.isPending ? (
              <LoadingRows />
            ) : detail.isError ? (
              <FormError text={message(detail.error, "Could not load this member.")} />
            ) : detail.data ? (
              <Detail key={detail.data.customer.note} detail={detail.data} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
