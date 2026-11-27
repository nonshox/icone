"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAvailabilityQuote } from "@/lib/api/queries";
import { useRescheduleBooking } from "@/lib/api/booking-queries";
import { useShopDate } from "@/lib/client/date";
import { addDays, formatDate, label } from "@/lib/domain/time";
import type { BookingRow } from "@/lib/domain/types";

/**
 * Move an upcoming visit. Slots come from `/api/availability` for the whole
 * visit duration; the server re-checks policy, working hours and collisions
 * before writing, and appends the change to the visit history.
 */
export function RescheduleControl({ booking }: { booking: BookingRow }) {
  const t = useT();
  const shopDate = useShopDate();
  const maxDate = shopDate ? addDays(shopDate, 60) : "";
  const services = booking.items.length > 0 ? booking.items : [booking.service];

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(booking.date);
  const [start, setStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quote = useAvailabilityQuote({
    barber: open ? booking.barber : "",
    date: open ? date : "",
    services,
  });
  const reschedule = useRescheduleBooking();

  function toggle() {
    setOpen((value) => !value);
    setDate(booking.date);
    setStart(null);
    setError(null);
  }

  function save() {
    if (start === null || !date) return;
    setError(null);
    reschedule.mutate(
      { id: booking.id, date, start },
      {
        onSuccess: (updated) => {
          toast.success(t("visits.rescheduled"), {
            description: `${formatDate(updated.date)} · ${label(updated.start)}`,
          });
          setOpen(false);
          setStart(null);
        },
        onError: (cause) => {
          const text =
            cause instanceof Error ? cause.message : t("auth.tryAgain");
          setError(text);
          toast.error(t("visits.rescheduleFailed"), { description: text });
        },
      },
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={toggle}>
        <CalendarClock aria-hidden />
        <T k="visits.reschedule" />
      </Button>

      {open ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium"><T k="visits.rescheduleTitle" /></p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDate(booking.date)} · {label(booking.start)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reschedule-date-${booking.id}`}>
              <T k="visits.newDate" />
            </Label>
            <Input
              id={`reschedule-date-${booking.id}`}
              type="date"
              value={date}
              min={shopDate}
              max={maxDate}
              className="h-9 w-full sm:w-52"
              onChange={(event) => {
                setDate(event.target.value);
                setStart(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label><T k="visits.newTime" /></Label>
            {!date ? (
              <p className="text-sm text-muted-foreground">
                <T k="visits.pickDateFirst" />
              </p>
            ) : quote.isPending ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-16" />
                ))}
              </div>
            ) : quote.isError ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive">
                  {quote.error instanceof Error
                    ? quote.error.message
                    : t("booking.timeLoadError")}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void quote.refetch()}
                >
                  <T k="common.tryAgain" />
                </Button>
              </div>
            ) : quote.data && quote.data.slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {quote.data.slots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    size="sm"
                    variant={start === slot.start ? "default" : "outline"}
                    aria-pressed={start === slot.start}
                    className="w-16 tabular-nums"
                    onClick={() => setStart(slot.start)}
                  >
                    {slot.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                <T k="booking.noTimes" />
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={start === null || reschedule.isPending}
              onClick={save}
            >
              {reschedule.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              <T k={reschedule.isPending ? "common.loading" : "visits.rescheduleSave"} />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={toggle}>
              <T k="common.cancel" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            <T k="visits.rescheduleHint" />
          </p>
        </div>
      ) : null}
    </div>
  );
}
