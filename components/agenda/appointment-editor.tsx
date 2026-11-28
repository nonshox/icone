"use client";

import { Check, Loader2, Plus, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { FormError, LoadingRows, message } from "@/components/ui/app-state";
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
import { useBarberCustomers } from "@/lib/api/barber-queries";
import {
  useAvailability,
  useBarbers,
} from "@/lib/api/queries";
import {
  useCreateWalkin,
  useWalkinServices,
  type WalkinInput,
  type WalkinSource,
} from "@/lib/api/walkin-queries";
import { useShopDate } from "@/lib/client/date";
import { formatPrice, label } from "@/lib/domain/time";
import type { BookingRow } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

/** Prefill passed by the calendar (or by a deep link into the editor). */
export type AppointmentDraft = {
  barber?: string;
  date?: string;
  start?: number;
  service?: string;
  source?: WalkinSource;
};

type Mode = "existing" | "new" | "walkin" | "phone";

const MAX_SERVICES = 8;

function modeOf(source: WalkinSource | undefined): Mode {
  if (source === "phone") return "phone";
  if (source === "manual") return "new";
  return "existing";
}

function sourceOf(mode: Mode): WalkinSource {
  if (mode === "phone") return "phone";
  if (mode === "new") return "manual";
  return "walkin";
}

/**
 * The one professional-side appointment editor. It is used inline on the
 * calendar, on `/agenda/walkin` and by waitlist deep links, so every entry
 * point creates the same kind of slot-blocking booking.
 */
export function AppointmentEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft?: AppointmentDraft | null;
  onClose?: () => void;
  onSaved?: (booking: BookingRow) => void;
} = {}) {
  const t = useT();
  const params = useSearchParams();
  const today = useShopDate();

  const linkStart = params.get("start");
  const linkSource = params.get("source");
  const initialSource: WalkinSource =
    draft?.source ??
    (linkSource === "phone" || linkSource === "manual" || linkSource === "walkin"
      ? linkSource
      : "walkin");

  const [barberChoice, setBarberChoice] = useState(
    draft?.barber ?? params.get("barber") ?? "",
  );
  const [pickedDate, setPickedDate] = useState(
    draft?.date ?? params.get("date") ?? "",
  );
  const [start, setStart] = useState(() => {
    const value = draft?.start;
    if (typeof value === "number" && Number.isInteger(value)) return String(value);
    if (linkStart && /^\d+$/.test(linkStart)) return linkStart;
    return "";
  });
  const [services, setServices] = useState<string[]>(() => {
    const first = draft?.service ?? params.get("service") ?? "";
    return first ? [first] : [];
  });
  const [mode, setMode] = useState<Mode>(modeOf(initialSource));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const date = pickedDate || today;
  const barbers = useBarbers();
  const customers = useBarberCustomers();
  // A workspace with one chair has no real choice to make. Keep that fallback
  // derived instead of copying query data into state in an effect.
  const barber =
    barberChoice || (barbers.data?.length === 1 ? barbers.data[0].id : "");
  const offered = useWalkinServices(barber);
  const slots = useAvailability({ barber, date, services });
  const create = useCreateWalkin();

  const menu = (offered.data ?? []).filter((row) => row.active && row.assigned);
  const picked = menu.filter((row) => services.includes(row.id));
  const totalPrice = picked.reduce((sum, row) => sum + row.ownPrice, 0);
  const totalTime = picked.reduce((sum, row) => sum + row.ownTime, 0);
  const startValue = start === "" ? Number.NaN : Number(start);
  const startValid =
    Number.isInteger(startValue) &&
    (slots.data ?? []).some((slot) => slot.start === startValue);

  const filteredCustomers = (customers.data ?? []).filter((row) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      row.name.toLowerCase().includes(needle) ||
      (row.phone ?? "").toLowerCase().includes(needle)
    );
  });

  const modeLabels: Record<Mode, string> = {
    existing: t("work.customers.title"),
    new: `${t("common.add")} · ${t("walkin.customer")}`,
    walkin: t("walkin.title"),
    phone: `${t("common.phone")} · ${t("common.book")}`,
  };

  const clientReady =
    mode === "existing"
      ? Boolean(selected)
      : mode === "new"
        ? name.trim().length > 0
        : mode === "phone"
          ? phone.trim().length > 0
          : true;
  const ready = Boolean(
    barber &&
      date &&
      menu.length > 0 &&
      services.length > 0 &&
      startValid &&
      clientReady &&
      !create.isPending,
  );

  function toggleService(id: string) {
    setSuccess("");
    setError(null);
    setServices((current) => {
      if (current.includes(id)) return current.filter((row) => row !== id);
      if (current.length >= MAX_SERVICES) return current;
      return [...current, id];
    });
    setStart("");
  }

  function submit() {
    if (!ready) return;
    setError(null);
    setSuccess("");

    const payload: WalkinInput = {
      barber,
      services,
      date,
      start: startValue,
      note: note.trim(),
      source: sourceOf(mode),
    };
    if (mode === "existing" && selected) {
      const customer = customers.data?.find((row) => row.id === selected);
      if (customer?.user && customer.user !== customer.id) {
        payload.user = customer.user;
      } else {
        payload.client = selected;
      }
    }
    if (mode === "new" || mode === "phone") {
      if (name.trim()) payload.name = name.trim();
      if (phone.trim()) payload.phone = phone.trim();
    }
    if (mode === "walkin" && phone.trim()) payload.phone = phone.trim();

    create.mutate(payload, {
      onSuccess: (booking) => {
        setSuccess(t("walkin.registered"));
        setServices([]);
        setStart("");
        toast.success(t("walkin.registered"));
        onSaved?.(booking);
      },
      onError: (cause) => {
        const text = message(cause, t("work.toast.failed"));
        setError(text);
        toast.error(text);
      },
    });
  }

  return (
    <Card className="glass">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>
            <T k="walkin.title" />
          </CardTitle>
          <CardDescription>
            <T k="walkin.subtitle" />
          </CardDescription>
        </div>
        {onClose ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------ client */}
        <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
          <h3 className="text-sm font-semibold">
            <T k="walkin.customer" />
          </h3>
          <div
            role="group"
            aria-label={t("walkin.customer")}
            className="flex flex-wrap gap-1"
          >
            {(["existing", "new", "walkin", "phone"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="xs"
                variant={mode === item ? "default" : "outline"}
                aria-pressed={mode === item}
                onClick={() => {
                  setMode(item);
                  setError(null);
                  setSuccess("");
                }}
              >
                {modeLabels[item]}
              </Button>
            ))}
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="editor-client-search">
                <T k="common.search" />
              </Label>
              <Input
                id="editor-client-search"
                value={query}
                placeholder={t("common.search")}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9"
              />
              {customers.isPending ? (
                <LoadingRows />
              ) : customers.isError ? (
                <FormError text={t("walkin.loadError")} />
              ) : filteredCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <T k="work.customers.empty" />
                </p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto" aria-label={t("work.customers.title")}>
                  {filteredCustomers.slice(0, 12).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-pressed={selected === row.id}
                        onClick={() => {
                          setSelected(selected === row.id ? "" : row.id);
                          setSuccess("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10",
                          selected === row.id && "border-brand/60 bg-brand/10",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {row.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.phone || t("common.phone")}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.visits}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {mode === "new" || mode === "phone" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="editor-name">
                  <T k="apply.name" />
                </Label>
                <Input
                  id="editor-name"
                  value={name}
                  maxLength={64}
                  onChange={(event) => setName(event.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editor-phone">
                  <T k="apply.phone" />
                </Label>
                <Input
                  id="editor-phone"
                  value={phone}
                  maxLength={32}
                  inputMode="tel"
                  placeholder="+998 90 123 45 67"
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          ) : null}

          {mode === "walkin" ? (
            <div className="space-y-1">
              <Label htmlFor="editor-walkin-phone">
                <T k="common.phone" />
              </Label>
              <Input
                id="editor-walkin-phone"
                value={phone}
                maxLength={32}
                inputMode="tel"
                placeholder="+998 90 123 45 67"
                onChange={(event) => setPhone(event.target.value)}
                className="h-9"
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="editor-note">
              <T k="walkin.note" />
            </Label>
            <Input
              id="editor-note"
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              className="h-9"
            />
          </div>
        </section>

        {/* -------------------------------------------- visit + services */}
        <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="editor-barber">
                <T k="walkin.professional" />
              </Label>
              <Select
                value={barber || undefined}
                onValueChange={(value) => {
                  setBarberChoice(String(value));
                  setServices([]);
                  setStart("");
                  setSuccess("");
                }}
              >
                <SelectTrigger id="editor-barber" className="h-9 w-full">
                  <SelectValue placeholder={t("walkin.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {(barbers.data ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {barbers.isError ? (
                <FormError text={t("walkin.loadError")} />
              ) : null}
              {!barbers.isPending && (barbers.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  <T k="booking.noBarbers" />
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="editor-date">
                <T k="walkin.date" />
              </Label>
              <Input
                id="editor-date"
                type="date"
                value={date}
                onChange={(event) => {
                  setPickedDate(event.target.value);
                  setStart("");
                  setSuccess("");
                }}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                <T k="booking.services" />
              </h3>
              {services.length > 0 ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setServices([]);
                    setStart("");
                  }}
                >
                  <T k="booking.clearServices" />
                </Button>
              ) : null}
            </div>

            {!barber ? (
              <p className="text-sm text-muted-foreground">
                <T k="booking.pickServiceBarber" />
              </p>
            ) : offered.isPending ? (
              <LoadingRows count={4} />
            ) : offered.isError ? (
              <FormError text={t("walkin.loadError")} />
            ) : menu.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <T k="walkin.noServices" />
              </p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-y-auto" aria-label={t("booking.services")}>
                {menu.map((row) => {
                  const checked = services.includes(row.id);
                  const blocked = !checked && services.length >= MAX_SERVICES;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        disabled={blocked}
                        onClick={() => toggleService(row.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50",
                          checked && "border-brand/60 bg-brand/10",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border border-input",
                            checked && "border-brand bg-brand text-brand-foreground",
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{row.name}</span>
                        <span className="shrink-0 text-xs font-medium tabular-nums">
                          {formatPrice(row.ownPrice)}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.ownTime} {t("common.minutes")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="editor-start">
              <T k="walkin.start" />
            </Label>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <T k="booking.pickServiceBarber" />
              </p>
            ) : slots.isFetching ? (
              <p className="text-sm text-muted-foreground">
                <T k="common.loading" />
              </p>
            ) : slots.isError ? (
              <FormError text={t("slots.error")} />
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <T k="slots.empty" />
              </p>
            ) : (
              <Select
                value={start || undefined}
                onValueChange={(value) => {
                  setStart(String(value));
                  setSuccess("");
                }}
              >
                <SelectTrigger id="editor-start" className="h-9 w-full">
                  <SelectValue placeholder={t("walkin.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {slots.data?.map((slot) => (
                    <SelectItem key={slot.start} value={String(slot.start)}>
                      {slot.label}–{label(slot.end)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {start && !startValid && !slots.isFetching ? (
              <p className="text-xs text-muted-foreground">
                <T k="booking.noTimes" />
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              <T k="booking.visitTime" />
            </span>
            <span className="font-medium tabular-nums">
              {formatPrice(totalPrice)} · {totalTime} {t("common.minutes")}
            </span>
          </div>

          {error ? <FormError text={error} /> : null}
          {success ? (
            <p role="status" className="rounded-lg border border-brand bg-brand/10 p-3 text-sm">
              {success}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!ready}
            onClick={submit}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {create.isPending ? t("common.loading") : t("walkin.submit")}
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
