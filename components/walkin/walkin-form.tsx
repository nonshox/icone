"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { T } from "@/components/i18n/t";
import { api } from "@/lib/api/client";
import { useBarbers, useAvailability } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import { useShopDate } from "@/lib/client/date";
import type { OfferedService } from "@/lib/domain/types";

export function WalkinForm() {
  const t = useT();
  const client = useQueryClient();
  const today = useShopDate();
  const barbers = useBarbers();
  const [barber, setBarber] = useState("");
  const [service, setService] = useState("");
  const [pickedDate, setPickedDate] = useState("");
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  // `useShopDate()` is empty on the server snapshot, so keep it derived
  // instead of seeding state once with an empty string.
  const date = pickedDate || today;

  const services = useQuery({
    queryKey: ["barber", "services", barber],
    queryFn: () =>
      api<{ services: OfferedService[] }>(
        `/api/barber/services?barber=${encodeURIComponent(barber)}`,
      ).then((result) => result.services),
    enabled: Boolean(barber),
  });

  const slots = useAvailability({ barber, date, service });

  const create = useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/api/walkins", {
        method: "POST",
        body: JSON.stringify({
          barber,
          services: [service],
          date,
          start: Number(start),
          name,
          phone,
          note,
        }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["walkin"] });
      void client.invalidateQueries({ queryKey: ["availability"] });
      void client.invalidateQueries({ queryKey: ["agenda"] });
      void client.invalidateQueries({ queryKey: ["bookings"] });
      setFeedback(t("walkin.registered"));
      setName("");
      setPhone("");
      setNote("");
      setStart("");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const ready = Boolean(barber && service && date && start && name);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        {barbers.isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
            {t("walkin.loadError")}
          </p>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span><T k="walkin.professional" /></span>
          <select
            value={barber}
            aria-label={t("walkin.professional")}
            onChange={(event) => {
              setBarber(event.target.value);
              setService("");
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">{t("walkin.choose")}</option>
            {(barbers.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="walkin.service" /></span>
          <select
            value={service}
            aria-label={t("walkin.service")}
            disabled={!barber || services.isPending}
            onChange={(event) => {
              setService(event.target.value);
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-50"
          >
            <option value="">{t("walkin.choose")}</option>
            {(services.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.ownPrice} UZS
              </option>
            ))}
          </select>
        </label>
        {services.isError ? (
          <p role="alert" className="text-sm text-destructive">{t("walkin.loadError")}</p>
        ) : null}
        {barber && !services.isPending && (services.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("walkin.noServices")}</p>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span><T k="walkin.date" /></span>
          <input
            type="date"
            value={date}
            aria-label={t("walkin.date")}
            onChange={(event) => {
              setPickedDate(event.target.value);
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="walkin.start" /></span>
          <select
            value={start}
            aria-label={t("walkin.start")}
            onChange={(event) => setStart(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">{t("walkin.choose")}</option>
            {(slots.data ?? []).map((slot) => (
              <option key={slot.start} value={slot.start}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        {slots.isFetching ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : null}
        {!service ? (
          <p className="text-xs text-muted-foreground">{t("slots.chooseDate")}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold"><T k="walkin.customer" /></h2>
        <label className="block space-y-1 text-sm">
          <span><T k="apply.name" /></span>
          <input
            value={name}
            aria-label={t("apply.name")}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="apply.phone" /></span>
          <input
            value={phone}
            aria-label={t("apply.phone")}
            placeholder="+998 90 123 45 67"
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="walkin.note" /></span>
          <input
            value={note}
            aria-label={t("walkin.note")}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        {feedback ? (
          <p role="status" className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">
            {feedback}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate()}
          className="rounded-xl bg-brand px-4 py-2 text-sm text-brand-foreground disabled:opacity-50"
        >
          {create.isPending ? t("common.loading") : t("walkin.submit")}
        </button>
      </section>
    </div>
  );
}
