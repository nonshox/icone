"use client";

import { CalendarDays, Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useBookings,
  useCreateReview,
  useSetStatus,
} from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import type { BookingRow, Status } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const badgeVariant: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  accepted: "secondary",
  booked: "default",
  done: "secondary",
  cancel: "outline",
  noshow: "destructive",
  rejected: "destructive",
};

function BookingCard({ booking }: { booking: BookingRow }) {
  const setStatus = useSetStatus();
  const t = useT();

  function cancel() {
    if (!window.confirm(t("visits.cancelAsk"))) return;

    setStatus.mutate(
      { id: booking.id, status: "cancel" },
      {
        onSuccess: () =>
          toast.success(t("visits.cancelled"), {
            description: `${formatDate(booking.date)} ${label(booking.start)}`,
          }),
        onError: (error) =>
          toast.error(t("visits.cancelFailed"), {
            description:
              error instanceof Error ? error.message : t("auth.tryAgain"),
          }),
      },
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{booking.serviceName}</p>
            <Badge variant={badgeVariant[booking.status]}>
              <T k={`status.${booking.status}`} />
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {booking.barberName} · {formatDate(booking.date)} ·{" "}
            {label(booking.start)} · {booking.serviceTime} min
          </p>
          <p className="text-sm font-medium tabular-nums">
            {formatPrice(booking.price)}
          </p>
          {booking.note ? (
            <p className="text-xs text-muted-foreground">“{booking.note}”</p>
          ) : null}
        </div>

        {["pending", "accepted", "booked"].includes(booking.status) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={setStatus.isPending}
            onClick={cancel}
          >
            {setStatus.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            <T k="visits.cancel" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewForm({ booking }: { booking: BookingRow }) {
  const create = useCreateReview();
  const t = useT();
  const [rate, setRate] = useState("5");
  const [note, setNote] = useState("");

  function submit() {
    create.mutate(
      { booking: booking.id, rate: Number(rate), note: note.trim() },
      {
        onSuccess: () => toast.success(t("visits.reviewThanks")),
        onError: (error) =>
          toast.error(t("visits.reviewFailed"), {
            description:
              error instanceof Error ? error.message : t("visits.tryShort"),
          }),
      },
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="size-4" aria-hidden />
          <T k="visits.reviewTitle" />
        </CardTitle>
        <CardDescription>
          {booking.serviceName} · {booking.barberName} ·{" "}
          {formatDate(booking.date)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Label htmlFor={`rate-${booking.id}`}><T k="visits.rating" /></Label>
          <Select value={rate} onValueChange={(value) => setRate(String(value))}>
            <SelectTrigger id={`rate-${booking.id}`} className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 4, 3, 2, 1].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} {t(value === 1 ? "visits.star" : "visits.stars")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={note}
          maxLength={400}
          placeholder={t("visits.reviewPlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />

        <Button
          size="sm"
          disabled={create.isPending}
          onClick={submit}
        >
          {create.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : null}
          <T k="visits.postReview" />
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <span className="grid size-10 place-items-center rounded-full bg-muted">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <p className="font-medium"><T k="visits.empty" /></p>
        <Link
          href="/book"
          className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
        >
          {t("booking.title")}
        </Link>
      </CardContent>
    </Card>
  );
}

export function BookingsView() {
  const t = useT();
  const bookings = useBookings();
  const todayDate = useShopDate();
  const [reviewFor, setReviewFor] = useState<string | null>(null);

  if (bookings.isPending || !todayDate) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (bookings.isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {bookings.error instanceof Error
            ? bookings.error.message
            : t("visits.loadError")}
        </CardContent>
      </Card>
    );
  }

  const all = bookings.data ?? [];

  if (all.length === 0) return <EmptyState />;

  const upcoming = all.filter(
    (booking) =>
      ["pending", "accepted", "booked"].includes(booking.status) &&
      booking.date >= todayDate,
  );
  const history = all
    .filter(
      (booking) =>
        !["pending", "accepted", "booked"].includes(booking.status) ||
        booking.date < todayDate,
    )
    .slice()
    .reverse();

  const reviewed = all.filter((booking) => booking.reviewed).length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium"><T k="visits.upcoming" /></h2>
            <p className="text-sm text-muted-foreground">
              {upcoming.length === 0
                ? t("visits.nothingBooked")
                : `${upcoming.length} ${t("visits.upcomingShort")}`}
            </p>
          </div>
          <Link
            href="/book"
            className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
          >
            <T k="nav.book" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <Card size="sm">
            <CardContent className="py-5 text-sm text-muted-foreground">
              {t("visits.bookService")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium"><T k="visits.history" /></h2>
          <p className="text-sm text-muted-foreground">
            {all.length - upcoming.length} {t("visits.pastVisits")} · {reviewed}{" "}
            {t("visits.reviewed")}
          </p>
        </div>

        {history.length === 0 ? (
          <Card size="sm">
            <CardContent className="py-5 text-sm text-muted-foreground">
              {t("visits.noPast")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((booking) => (
              <div key={booking.id} className="space-y-3">
                <BookingCard booking={booking} />
                {booking.status === "done" && !booking.reviewed ? (
                  reviewFor === booking.id ? (
                    <ReviewForm booking={booking} />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewFor(booking.id)}
                    >
                      <Star className="size-3.5" aria-hidden />
                      <T k="visits.review" />
                    </Button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
