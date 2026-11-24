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
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

  const [weekOffset, setWeekOffset] = useState(0);
  const shopDate = useShopDate();
  const days = useMemo(() => {
    if (!shopDate) return [];
    const from = addDays(shopDate, weekOffset * 7);
    const to = addDays(from, 7);
    return nextDates(60).filter((day) => day >= from && day < to);
  }, [shopDate, weekOffset]);
  const maxDate = useMemo(
    () => (shopDate ? addDays(shopDate, 60) : ""),
    [shopDate],
  );
  const date = storedDate || days[0] || "";

  const services = useServices();
  const barbers = useBarbers();
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

      toast.success("Chair booked", {
        description: `${booking.serviceName} with ${booking.barberName} · ${formatDate(booking.date)} at ${label(booking.start)}.`,
      });

      useBookingDraft.getState().reset();
      router.push("/bookings");
    } catch (error) {
      toast.error("Could not book", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Times are Tashkent time.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select
              value={serviceId || null}
              onValueChange={(value) => setService(String(value ?? ""))}
            >
              <SelectTrigger id="service" className="h-9 w-full">
                <SelectValue placeholder="Pick a service" />
              </SelectTrigger>
              <SelectContent>
                {(services.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.time} min · {formatPrice(item.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {services.isPending ? <Skeleton className="h-4 w-40" /> : null}
            {services.isError ? (
              <p className="text-xs text-destructive">
                Could not load the menu.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barber">Barber</Label>
            <Select
              value={barberId || null}
              onValueChange={(value) => setBarber(String(value ?? ""))}
            >
              <SelectTrigger id="barber" className="h-9 w-full">
                <SelectValue placeholder="Pick a barber" />
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
                Could not load the barbers.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Date</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Previous week"
                disabled={weekOffset === 0}
                onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
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
                aria-label="Next week"
                disabled={weekOffset >= 8}
                onClick={() => setWeekOffset((value) => Math.min(8, value + 1))}
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
            onChange={(event) => {
              const value = event.target.value;
              setDate(value);
              const index = nextDates(60).indexOf(value);
              if (index >= 0) setWeekOffset(Math.floor(index / 7));
            }}
            className="h-9 w-44"
            aria-label="Or pick another date"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Time</Label>

          {!serviceId || !barberId ? (
            <p className="text-sm text-muted-foreground">
              Choose a service and a barber to see open times.
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
                : "Could not load times."}
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
              No open times for this day. Try another date or barber.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea
            id="note"
            value={note}
            maxLength={200}
            placeholder="Anything the barber should know?"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Scissors className="size-4" aria-hidden />
              {service ? service.name : "No service yet"}
            </span>
            <span className="font-medium tabular-nums">
              {service ? formatPrice(service.price) : "—"}
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
          {create.isPending ? "Booking" : "Confirm booking"}
        </Button>
      </CardContent>
    </Card>
  );
}
