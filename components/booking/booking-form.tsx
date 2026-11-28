"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Scissors,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { api, ApiError } from "@/lib/api/client";
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
  availabilityQuery,
  useAvailabilityQuote,
  useBarbers,
  useCreateBooking,
  useMe,
  useServices,
  type AvailabilityQuote,
} from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { priceOf, visitPrice } from "@/lib/domain/pricing";
import {
  addDays,
  formatDate,
  formatMonth,
  formatPrice,
  label,
  nextDates,
} from "@/lib/domain/time";
import type { Barber, Service } from "@/lib/domain/types";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { cn } from "@/lib/utils";

/** Services a given barber can actually perform. */
function compatible(service: Service, barber: Barber | undefined): boolean {
  if (!barber) return true;
  if (barber.business) return service.business === barber.business;
  return service.barber === barber.id;
}

/** How far the no-slot recovery looks. Same horizon as the domain helper. */
const RECOVERY_DAYS = 14;
const ALL_PROFESSIONALS_DAYS = 7;

export function BookingForm() {
  const router = useRouter();
  const t = useT();

  const servicesInDraft = useBookingDraft((state) => state.services);
  const barberId = useBookingDraft((state) => state.barber);
  const business = useBookingDraft((state) => state.business);
  const branch = useBookingDraft((state) => state.branch);
  const anyBarber = useBookingDraft((state) => state.anyBarber);
  const storedDate = useBookingDraft((state) => state.date);
  const start = useBookingDraft((state) => state.start);
  const note = useBookingDraft((state) => state.note);
  const setServices = useBookingDraft((state) => state.setServices);
  const toggleService = useBookingDraft((state) => state.toggleService);
  const setBarber = useBookingDraft((state) => state.setBarber);
  const setDate = useBookingDraft((state) => state.setDate);
  const setStart = useBookingDraft((state) => state.setStart);
  const setNote = useBookingDraft((state) => state.setNote);

  const me = useMe();
  const guest = me.isError || (me.isSuccess && !me.data?.user);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recovery, setRecovery] = useState("");

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
  const barber = barbers.data?.find((item) => item.id === barberId);
  // `any` needs a real shop scope on the server; without one the visitor picks
  // a person from the full catalogue instead.
  const useAny = anyBarber && Boolean(business);
  const visibleServices = useMemo(
    () =>
      (services.data ?? []).filter((item) =>
        anyBarber
          ? !business || item.business === business
          : compatible(item, barber),
      ),
    [services.data, barber, anyBarber, business],
  );

  // A deep link or a rebook can seed a service that is no longer offered by
  // the chosen barber. Drop it once both catalogues are available.
  useEffect(() => {
    if (!barberId || anyBarber || !barber || !services.data) return;
    const allowed = new Set(
      (services.data ?? [])
        .filter((item) => compatible(item, barber))
        .map((item) => item.id),
    );
    const kept = servicesInDraft.filter((id) => allowed.has(id));
    if (kept.length !== servicesInDraft.length) setServices(kept);
  }, [barberId, anyBarber, barber, services.data, servicesInDraft, setServices]);

  function chooseBarber(value: string | null) {
    const id = String(value ?? "");
    if (id === "any") {
      useBookingDraft.getState().setAnyBarber(true);
      return;
    }
    setBarber(id);
    if (!services.data) return;
    const next = barbers.data?.find((item) => item.id === id);
    const allowed = new Set(
      services.data.filter((item) => compatible(item, next)).map((item) => item.id),
    );
    setServices(servicesInDraft.filter((item) => allowed.has(item)));
  }

  // One availability call covers the whole visit: the server resolves every
  // service for this barber and returns slots for the combined duration.
  const quote = useAvailabilityQuote({
    barber: useAny ? "any" : barberId,
    date,
    services: servicesInDraft,
    any: useAny,
    business,
    branch,
  });
  const create = useCreateBooking();
  const [waitFeedback, setWaitFeedback] = useState("");
  const joinWait = useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/api/waits", {
        method: "POST",
        body: JSON.stringify({
          barber: matchedBarberForWait(),
          service: servicesInDraft[0],
          note: note.trim(),
        }),
      }),
    onSuccess: () => {
      setWaitFeedback(t("booking.waitlistJoined"));
      toast.success(t("booking.waitlistJoined"));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        router.push(signInHref());
        return;
      }
      toast.error(t("booking.waitlistFailed"));
    },
  });

  function matchedBarberForWait(): string {
    return useAny ? quote.data?.barber ?? "" : barberId;
  }

  const resolved = quote.data?.services ?? [];
  const selectedNames = servicesInDraft.map(
    (id) =>
      resolved.find((item) => item.id === id)?.name ??
      services.data?.find((item) => item.id === id)?.name ??
      id,
  );
  const totalPrice =
    quote.data?.price ??
    visitPrice(
      servicesInDraft
        .map((id) => services.data?.find((item) => item.id === id))
        .filter((item): item is Service => !!item),
    );
  const matchedBarber = useAny ? quote.data?.barber ?? "" : barberId;
  const ready =
    servicesInDraft.length > 0 &&
    Boolean(matchedBarber && date && start !== null);

  // The draft survives sign-in as canonical URL params (note included) even
  // when the round trip reloads the page; the store keeps it during SPA hops.
  function bookingHref(): string {
    const params = new URLSearchParams();
    if (business) params.set("business", business);
    if (branch) params.set("branch", branch);
    if (useAny) params.set("any", "1");
    else if (barberId) params.set("barber", barberId);
    servicesInDraft.forEach((id) => params.append("services", id));
    if (date) params.set("date", date);
    if (start !== null) params.set("start", String(start));
    if (note.trim()) params.set("note", note.trim());
    const query = params.toString();
    return query ? `/book?${query}` : "/book";
  }

  function signInHref(): string {
    return `/sign-in?next=${encodeURIComponent(bookingHref())}`;
  }

  /** One day of real availability, using the same query as the live quote. */
  async function slotsOn(input: {
    barber: string;
    any: boolean;
    business: string;
    branch: string;
    date: string;
  }): Promise<AvailabilityQuote | null> {
    const query = availabilityQuery(
      {
        barber: input.barber,
        date: input.date,
        services: servicesInDraft,
        any: input.any,
        business: input.business,
        branch: input.branch,
      },
      servicesInDraft,
    );
    try {
      return await api<AvailabilityQuote>(`/api/availability?${query}`);
    } catch {
      return null;
    }
  }

  function recoveryFrom(): string {
    if (shopDate && date && date >= shopDate) return addDays(date, 1);
    return shopDate ?? (date || "");
  }

  /** `firstAvailable` semantics over the existing endpoint, scoped as today. */
  async function findNextDate() {
    const from = recoveryFrom();
    if (!from || servicesInDraft.length === 0) return;
    setRecoveryBusy(true);
    setRecovery("");
    try {
      for (let offset = 0; offset < RECOVERY_DAYS; offset += 1) {
        const day = addDays(from, offset);
        if (maxDate && day > maxDate) break;
        const found = await slotsOn({
          barber: useAny ? "any" : barberId,
          any: useAny,
          business,
          branch,
          date: day,
        });
        if (found && found.slots.length > 0) {
          setDate(day);
          setStart(found.slots[0].start);
          return;
        }
      }
      setRecovery(t("booking.noOpeningFound"));
    } finally {
      setRecoveryBusy(false);
    }
  }

  /** Drop the shop scope and find a real professional with a free slot. */
  async function checkAllProfessionals() {
    const from = recoveryFrom();
    const candidates = barbers.data ?? [];
    if (!from || servicesInDraft.length === 0 || candidates.length === 0) return;
    setRecoveryBusy(true);
    setRecovery("");
    try {
      for (let offset = 0; offset < ALL_PROFESSIONALS_DAYS; offset += 1) {
        const day = addDays(from, offset);
        if (maxDate && day > maxDate) break;
        const matches = await Promise.all(
          candidates.map(async (candidate) => {
            const found = await slotsOn({
              barber: candidate.id,
              any: false,
              business: "",
              branch: "",
              date: day,
            });
            return found && found.slots.length > 0
              ? { barber: candidate.id, start: found.slots[0].start }
              : null;
          }),
        );
        const hit = matches.find(
          (row): row is { barber: string; start: number } => row !== null,
        );
        if (hit) {
          useBookingDraft.setState({
            business: "",
            branch: "",
            anyBarber: false,
            barber: hit.barber,
            date: day,
            start: hit.start,
          });
          return;
        }
      }
      // Nothing free nearby: still drop the shop scope so every professional
      // can be browsed, and say why no times appeared.
      useBookingDraft.setState({ business: "", branch: "", anyBarber: false });
      setRecovery(t("booking.noOpeningFound"));
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function submit() {
    if (!matchedBarber || !date || start === null || servicesInDraft.length === 0) return;
    if (guest) {
      router.push(signInHref());
      return;
    }

    try {
      const booking = await create.mutateAsync({
        barber: matchedBarber,
        services: servicesInDraft,
        date,
        start,
        note: note.trim(),
      });

      toast.success(t("booking.booked"), {
        description: `${selectedNames.join(" + ")} · ${booking.barberName} · ${formatDate(booking.date)} ${label(booking.start)}`,
      });

      useBookingDraft.getState().reset();
      router.push("/bookings");
    } catch (error) {
      // A session can expire between render and submit; fall back to the same
      // sign-in round trip instead of showing a misleading booking error.
      if (error instanceof ApiError && error.status === 401) {
        router.push(signInHref());
        return;
      }
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label><T k="booking.services" /></Label>
            {servicesInDraft.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setServices([])}
              >
                <T k="booking.clearServices" />
              </Button>
            ) : null}
          </div>

          {services.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : services.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-destructive">
                <T k="booking.loadError" />
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void services.refetch()}
              >
                <T k="common.tryAgain" />
              </Button>
            </div>
          ) : visibleServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <T k="booking.noServicesAvailable" />
            </p>
          ) : (
            <div className="grid gap-2">
              {visibleServices.map((item) => {
                const selected = servicesInDraft.includes(item.id);
                const offer = resolved.find((entry) => entry.id === item.id);
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    aria-pressed={selected}
                    className="h-auto min-h-10 w-full justify-start gap-2 py-2"
                    onClick={() => toggleService(item.id)}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        selected ? "border-primary bg-primary/20" : "border-muted-foreground/40",
                      )}
                    >
                      {selected ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
                    <span className="shrink-0 text-xs tabular-nums">
                      {formatPrice(priceOf(offer ?? item))}
                    </span>
                    <span className="shrink-0 text-xs opacity-70 tabular-nums">
                      {offer?.time ?? item.time} {t("common.minutes")}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="barber"><T k="booking.barber" /></Label>
          <Select
            value={useAny ? "any" : barberId || null}
            onValueChange={(value) => {
              if (value) chooseBarber(value);
            }}
          >
            <SelectTrigger id="barber" className="h-9 w-full">
              <SelectValue placeholder={t("booking.barber")} />
            </SelectTrigger>
            <SelectContent>
              {business ? (
                <SelectItem value="any">{t("booking.anyBarber")}</SelectItem>
              ) : null}
              {(barbers.data ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} · {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {useAny && quote.data?.barberName ? (
            <p role="status" className="text-xs text-muted-foreground">
              {t("booking.matchedBarber")}: {quote.data.barberName}
            </p>
          ) : null}
          {useAny && quote.data && !quote.data.barber ? (
            <p className="text-xs text-muted-foreground">
              {t("booking.noBarberAvailable")}
            </p>
          ) : null}
          {barbers.isPending ? <Skeleton className="h-4 w-40" /> : null}
          {barbers.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-destructive">
                <T k="booking.barberLoadError" />
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void barbers.refetch()}
              >
                <T k="common.tryAgain" />
              </Button>
            </div>
          ) : null}
          {barbers.isSuccess && (barbers.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <T k="booking.noBarbers" />
            </p>
          ) : null}
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
              <span className="min-w-28 text-center text-xs font-medium text-muted-foreground">
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

          {servicesInDraft.length === 0 || !matchedBarber ? (
            <p className="text-sm text-muted-foreground">
              <T k="booking.pickServiceBarber" />
            </p>
          ) : quote.isPending ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
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
                  className="w-16 tabular-nums"
                  onClick={() => setStart(slot.start)}
                >
                  {slot.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                <T k="booking.noTimes" />
              </p>
              {matchedBarber && servicesInDraft.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={recoveryBusy}
                    onClick={() => void findNextDate()}
                  >
                    {recoveryBusy ? t("common.loading") : t("booking.nextAvailable")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={recoveryBusy}
                    onClick={() => void checkAllProfessionals()}
                  >
                    {t("booking.checkAllProfessionals")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={joinWait.isPending}
                    onClick={() => {
                      if (guest) router.push(signInHref());
                      else joinWait.mutate();
                    }}
                  >
                    {joinWait.isPending
                      ? t("common.loading")
                      : t("booking.joinWaitlist")}
                  </Button>
                  <Link href="/waits" className="text-xs text-brand-strong hover:underline">
                    <T k="nav.waitlist" />
                  </Link>
                </div>
              ) : null}
              {recovery ? (
                <p role="status" className="text-xs text-muted-foreground">
                  {recovery}
                </p>
              ) : null}
              {waitFeedback ? (
                <p role="status" className="text-xs text-brand-strong">
                  {waitFeedback}
                </p>
              ) : null}
            </div>
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

        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Scissors className="size-4" aria-hidden />
              {selectedNames.length > 0 ? selectedNames.join(" + ") : t("booking.noService")}
            </span>
            <span className="font-medium tabular-nums">{formatPrice(totalPrice)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock3 className="size-3.5" aria-hidden />
              {t("booking.visitTime")}:{" "}
              {quote.data ? `${quote.data.time} ${t("common.minutes")}` : "—"}
            </span>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-3.5" aria-hidden />
              {date ? formatDate(date) : "—"}
              {start !== null ? ` · ${label(start)}` : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("booking.totalHint")}
          </p>
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
          {create.isPending ? (
            <T k="common.loading" />
          ) : guest ? (
            <T k="booking.signInToConfirm" />
          ) : (
            <T k="booking.confirm" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
