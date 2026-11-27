"use client";

import {
  CalendarDays,
  Clock,
  Loader2,
  MessageCircle,
  Star,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useBookings, useCreateReview, useProfile, useSetStatus } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import { CANCELLABLE, type BookingRow, type Status } from "@/lib/domain/types";

const badgeVariant: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "default",
  rejected: "destructive",
  cancelled: "outline",
  done: "secondary",
  noshow: "destructive",
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
  const t = useT();
  const todayDate = useShopDate();
  const bookings = useBookings();
  const setStatus = useSetStatus();
  const review = useCreateReview();
  const profile = useProfile();
  const [rate, setRate] = useState("5");
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const row = bookings.data?.find((booking) => booking.id === id);

  function cancelVisit(visit: BookingRow) {
    if (!window.confirm(t("visits.cancelAsk"))) return;

    setActionError(null);
    setStatus.mutate(
      { id: visit.id, status: "cancelled" },
      {
        onSuccess: () =>
          toast.success(t("visits.cancelled"), {
            description: `${formatDate(visit.date)} ${label(visit.start)}`,
          }),
        onError: (error) => {
          const text = message(error, t("auth.tryAgain"));
          setActionError(text);
          toast.error(t("visits.cancelFailed"), { description: text });
        },
      },
    );
  }

  function submitReview(visit: BookingRow) {
    setActionError(null);
    review.mutate(
      { booking: visit.id, rate: Number(rate), note: note.trim() },
      {
        onSuccess: () => toast.success(t("visits.reviewThanks")),
        onError: (error) => {
          const text = message(error, t("visits.tryShort"));
          setActionError(text);
          toast.error(t("visits.reviewFailed"), { description: text });
        },
      },
    );
  }

  if (bookings.isPending || !todayDate) return <DetailSkeleton />;

  if (bookings.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("visits.loadFailed")}</CardTitle>
          <CardDescription><T k="visits.tryShort" /></CardDescription>
        </CardHeader>
        <CardContent>
          <p role="alert" aria-live="polite" className="text-sm text-destructive">
            {message(bookings.error, t("visits.loadError"))}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!row) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("visits.notFound")}</CardTitle>
          <CardDescription><T k="visits.tryShort" /></CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/bookings"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <T k="nav.myVisits" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const canCancel = CANCELLABLE.includes(row.status) && row.date >= todayDate;
  const canReview = (row.status === "done" || row.status === "noshow") && !row.reviewed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {profile.data?.role === "client" ? (
          <Link
            href={`/messages?barber=${row.barber}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <MessageCircle aria-hidden />
            <T k="visits.message" />
          </Link>
        ) : null}
        <Link
          href={`/book?barber=${row.barber}&service=${row.service}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <T k="visits.bookAgain" />
        </Link>
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{row.serviceName}</CardTitle>
              <CardDescription>· {row.barberName}</CardDescription>
            </div>
            <Badge variant={badgeVariant[row.status]}>
              <T k={`status.${row.status}`} />
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                <T k="visits.when" />
              </dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-brand-strong" aria-hidden />
                <span className="tabular-nums">
                  {formatDate(row.date)} · {label(row.start)}–{label(row.end)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                <T k="visits.duration" />
              </dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4 text-brand-strong" aria-hidden />
                {row.serviceTime} {t("common.minutes")}
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                <T k="visits.price" />
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
                  <T k="visits.yourNote" />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">“{row.note}”</p>
              </div>
            </>
          ) : null}

          {canCancel ? (
            <>
              <Separator />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => cancelVisit(row)}
                >
                  {setStatus.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  <T k="visits.cancel" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  <T k="visits.cancelHint" />
                </p>
              </div>
            </>
          ) : null}

          {canReview ? (
            <div className="space-y-4">
              <Separator />
              <div>
                <h2 className="flex items-center gap-2 text-base font-medium">
                  <Star className="size-4 text-brand-strong" aria-hidden />
                  <T k="visits.reviewTitle" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("visits.reviewQuestion")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor={`rate-${row.id}`}><T k="visits.rating" /></Label>
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
                        {value} {t(value === 1 ? "visits.star" : "visits.stars")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`note-${row.id}`}><T k="visits.note" /></Label>
                <Textarea
                  id={`note-${row.id}`}
                  value={note}
                  maxLength={400}
                  placeholder={t("visits.reviewPlaceholder")}
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
                <T k="visits.postReview" />
              </Button>
            </div>
          ) : null}

          {row.reviewed ? (
            <>
              <Separator />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="size-4 text-brand-strong" aria-hidden />
                <T k="visits.reviewedThis" />
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
