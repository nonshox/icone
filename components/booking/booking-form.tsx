"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Scissors,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
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
  useAvailability,
  useBarbers,
  useCreateBooking,
  useServices,
} from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { priceOf } from "@/lib/domain/pricing";
import {
  addDays,
  formatDate,
  formatMonth,
  formatPrice,
  label,
  nextDates,
} from "@/lib/domain/time";
import { useBookingDraft } from "@/lib/store/booking";

export function BookingForm() {
  const router = useRouter();
  const t = useT();

  const serviceId = useBookingDraft((state) => state.service);
  const barberId = useBookingDraft((state) => state.barber);
  const storedDate = useBookingDraft((state) => state.date);
  const start = useBookingDraft((state) => state.start);
  const note = useBookingDraft((state) => state.note);
  const setService = useBookingDraft((state) => state.setService);
  const setBarber = useBookingDraft((state) => state.setBarber);
  const setDate = useBookingDraft((state) => state.setDate);
  const setStart = useBookingDraft((state) => state.setStart);
  const setNote = useBookingDraft((state) => state.setNote);

  const shopDate = useShopDate();
  const maxDate = useMemo(
    () => (shopDate ? addDays(shopDate, 60) : ""),
    [shopDate],
  );
  const date = storedDate || shopDate || "";

  const weekStart = useMemo(() => {
    if (!shopDate || !date) return "";
    const offset = Math.floor(
      (Date.parse(date) - Date.parse(shopDate)) / 86_400_000,
    );
    return addDays(shopDate, Math.max(0, Math.floor(offset / 7)) * 7);
  }, [shopDate, date]);

  const days = useMemo(() => {
    if (!weekStart) return [];
    const to = addDays(weekStart, 7);
    return nextDates(60).filter((day) => day >= weekStart && day < to);
  }, [weekStart]);

  const canPrev = Boolean(shopDate && date && addDays(date, -7) >= shopDate);
  const canNext = Boolean(maxDate && date && addDays(date, 7) <= maxDate);

  const services = useServices();
  const barbers = useBarbers();
  const visibleServices = useMemo(() => {
    const all = services.data ?? [];
    if (!barberId) return all;
    return all.filter((item) => !item.barber || item.barber === barberId);
  }, [services.data, barberId]);

  useEffect(() => {
    if (!serviceId || !barberId) return;
    const chosen = services.data?.find((item) => item.id === serviceId);
    if (chosen?.barber && chosen.barber !== barberId) setService("");
  }, [serviceId, barberId, services.data, setService]);

  const availability = useAvailability({
    barber: barberId,
    date,
    service: serviceId,
  });
  const create = useCreateBooking();

  const service = services.data?.find((item) => item.id === serviceId);
  const barber = barbers.data?.find((item) => item.id === barberId);
  const ready = Boolean(service && barber && date && start !== null);

  async function submit() {
    if (!service || !barber || start === null || !date) return;

    try {
      const booking = await create.mutateAsync({
        barber: barber.id,
        service: service.id,
        date,
        start,
        note: note.trim(),
      });

      toast.success(t("booking.booked"), {
        description: `${booking.serviceName} · ${booking.barberName} · ${formatDate(booking.date)} ${label(booking.start)}`,
      });

      useBookingDraft.getState().reset();
      router.push("/bookings");
    } catch (error) {
      toast.error(t("booking.failed"), {
        description:
          error instanceof Error ? error.message : t("auth.tryAgain"),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><T k="booking.details" /></CardTitle>
        <CardDescription><T k="booking.timezone" /></CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="service"><T k="booking.service" /></Label>
            <Select
              value={serviceId || null}
              onValueChange={(value) => setService(String(value ?? ""))}
            >
              <SelectTrigger id="service" className="h-9 w-full">
                <SelectValue placeholder={t("booking.service")} />
              </SelectTrigger>
              <SelectContent>
                {visibleServices.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.time} <T k="common.minutes" /> ·{" "}
                    {formatPrice(priceOf(item))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {services.isPending ? <Skeleton className="h-4 w-40" /> : null}
            {services.isError ? (
              <p className="text-xs text-destructive">
                <T k="booking.loadError" />
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barber"><T k="booking.barber" /></Label>
            <Select
              value={barberId || null}
              onValueChange={(value) => setBarber(String(value ?? ""))}
            >
              <SelectTrigger id="barber" className="h-9 w-full">
                <SelectValue placeholder={t("booking.barber")} />
              </SelectTrigger>
              <SelectContent>
                {(barbers.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {barbers.isPending ? <Skeleton className="h-4 w-40" /> : null}
            {barbers.isError ? (
              <p className="text-xs text-destructive">
                <T k="booking.barberLoadError" />
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label><T k="booking.date" /></Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={t("booking.prevWeek")}
                disabled={!canPrev}
                onClick={() => { if (date) setDate(addDays(date, -7)); }}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </Button>
              <span className="min-w-32 text-center text-xs font-medium text-muted-foreground">
                {days.length > 0 ? formatMonth(days[0]) : "—"}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={t("booking.nextWeek")}
                disabled={!canNext}
                onClick={() => { if (date) setDate(addDays(date, 7)); }}
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={date === day ? "default" : "outline"}
                onClick={() => setDate(day)}
              >
                {formatDate(day)}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={date}
            min={shopDate}
            max={maxDate}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 w-44"
            aria-label={t("booking.orPickDate")}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label><T k="booking.time" /></Label>

          {!serviceId || !barberId ? (
            <p className="text-sm text-muted-foreground">
              <T k="booking.pickServiceBarber" />
            </p>
          ) : availability.isPending ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-16" />
              ))}
            </div>
          ) : availability.isError ? (
            <p className="text-sm text-destructive">
              {availability.error instanceof Error
                ? availability.error.message
                : t("booking.timeLoadError")}
            </p>
          ) : availability.data && availability.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availability.data.map((slot) => (
                <Button
                  key={slot.start}
                  type="button"
                  size="sm"
                  variant={start === slot.start ? "default" : "outline"}
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

        <div className="space-y-2">
          <Label htmlFor="note"><T k="booking.noteOptional" /></Label>
          <Textarea
            id="note"
            value={note}
            maxLength={200}
            placeholder={t("booking.notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Scissors className="size-4" aria-hidden />
              {service ? service.name : t("booking.noService")}
            </span>
            <span className="font-medium tabular-nums">
              {service ? formatPrice(priceOf(service)) : "—"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock3 className="size-3.5" aria-hidden />
              {service ? `${service.time} min` : "—"}
            </span>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-3.5" aria-hidden />
              {date ? formatDate(date) : "—"}
              {start !== null ? ` · ${label(start)}` : ""}
            </span>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!ready || create.isPending}
          onClick={submit}
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {create.isPending ? <T k="common.loading" /> : <T k="booking.confirm" />}
        </Button>
      </CardContent>
    </Card>
  );
}
