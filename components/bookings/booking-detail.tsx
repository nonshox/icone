"use client";

import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  MessageCircle,
  Star,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useBooking,
  useCancelBooking,
  useReviewBooking,
} from "@/lib/api/booking-queries";
import { ApiError } from "@/lib/api/client";
import { usePayment } from "@/lib/api/message-queries";
import { useProfile } from "@/lib/api/queries";
import type {
  PaymentMethod,
  PaymentStatus,
} from "@/lib/domain/payments";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import { STATUS_LABEL, type BookingRow, type Status } from "@/lib/domain/types";

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

const paymentLabel: Record<PaymentStatus, string> = {
  pending: "Pending at shop",
  paid: "Paid",
  partial: "Partly paid",
  refunded: "Refunded",
  unpaid: "Unpaid",
};

const methodLabel: Record<PaymentMethod, string> = {
  shop: "At the shop",
  card: "Card",
  transfer: "Transfer",
};

const paymentVariant: Record<
  PaymentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  paid: "secondary",
  partial: "outline",
  refunded: "destructive",
  unpaid: "destructive",
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const review = useReviewBooking();
  const profile = useProfile();
  const payment = usePayment(booking.data?.id ?? "");
  const [rate, setRate] = useState("5");
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const row = booking.data;

  function cancelVisit(visit: BookingRow) {
    if (!window.confirm("Cancel this booking?")) return;

    setActionError(null);
    cancel.mutate(visit.id, {
      onSuccess: () =>
        toast.success("Booking cancelled", {
          description: `${formatDate(visit.date)} at ${label(visit.start)}.`,
        }),
      onError: (error) => {
        const text = message(error, "Please try again.");
        setActionError(text);
        toast.error("Could not cancel", { description: text });
      },
    });
  }

  function submitReview(visit: BookingRow) {
    setActionError(null);
    review.mutate(
      { booking: visit.id, rate: Number(rate), note: note.trim() },
      {
        onSuccess: () =>
          toast.success("Thanks for the review"),
        onError: (error) => {
          const text = message(error, "Please try again.");
          setActionError(text);
          toast.error("Could not save the review", { description: text });
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          My visits
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {profile.data?.role === "client" && booking.data ? (
            <Link
              href={`/messages?barber=${booking.data.barber}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <MessageCircle aria-hidden />
              Message barber
            </Link>
          ) : null}
          <Link
            href={`/book?barber=${booking.data?.barber ?? ""}&service=${booking.data?.service ?? ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Book again
          </Link>
        </div>
      </div>

      {actionError ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {booking.isPending ? <DetailSkeleton /> : null}

      {booking.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {booking.error instanceof ApiError && booking.error.status === 404
                ? "Visit not found"
                : "Could not load this visit"}
            </CardTitle>
            <CardDescription>Try again shortly.</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {message(booking.error, "Please try again.")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {row ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{row.serviceName}</CardTitle>
                <CardDescription>with {row.barberName}</CardDescription>
              </div>
              <Badge variant={badgeVariant[row.status]}>
                {STATUS_LABEL[row.status]}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  When
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <CalendarDays
                    className="size-4 text-brand-strong"
                    aria-hidden
                  />
                  <span className="tabular-nums">
                    {formatDate(row.date)} · {label(row.start)}–{label(row.end)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Duration
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <Clock className="size-4 text-brand-strong" aria-hidden />
                  {row.serviceTime} min
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  Price
                </dt>
                <dd className="mt-1 text-sm font-medium tabular-nums">
                  {formatPrice(row.price)}
                </dd>
              </div>
            </dl>

            {row.note ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Your note
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    “{row.note}”
                  </p>
                </div>
              </>
            ) : null}

            {row.status === "booked" ? (
              <>
                <Separator />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancelVisit(row)}
                  >
                    {cancel.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Cancel booking
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Cancel before the visit starts.
                  </p>
                </div>
              </>
            ) : null}

            {row.status === "done" ? (
              row.reviewed ? (
                <>
                  <Separator />
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star
                      className="size-4 text-brand-strong"
                      aria-hidden
                    />
                    You reviewed this visit.
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-medium">
                      <Star
                        className="size-4 text-brand-strong"
                        aria-hidden
                      />
                      Review your visit
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      How was {row.serviceName} with {row.barberName}?
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Label htmlFor={`rate-${row.id}`}>Rating</Label>
                    <Select
                      value={rate}
                      onValueChange={(value) => setRate(String(value))}
                    >
                      <SelectTrigger id={`rate-${row.id}`} className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value} {value === 1 ? "star" : "stars"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`note-${row.id}`}>Note</Label>
                    <Textarea
                      id={`note-${row.id}`}
                      value={note}
                      maxLength={400}
                      placeholder="How was the cut?"
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>

                  <Button
                    disabled={review.isPending}
                    onClick={() => submitReview(row)}
                  >
                    {review.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Post review
                  </Button>
                </div>
              )
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {row && profile.data?.role === "client" ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4 text-brand-strong" aria-hidden />
                  Payment
                </CardTitle>
                <CardDescription>
                  {payment.data ? "Settle this at the shop." : "No payment recorded."}
                </CardDescription>
              </div>
              {payment.data ? (
                <Badge variant={paymentVariant[payment.data.status]}>
                  {paymentLabel[payment.data.status]}
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            {payment.isPending ? (
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : null}

            {payment.isError ? (
              <p
                role="alert"
                aria-live="polite"
                className="text-sm text-destructive"
              >
                {message(payment.error, "Could not load the payment.")}
              </p>
            ) : null}

            {payment.data ? (
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Amount
                  </dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {formatPrice(payment.data.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Method
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {methodLabel[payment.data.method]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Status
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {paymentLabel[payment.data.status]}
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
