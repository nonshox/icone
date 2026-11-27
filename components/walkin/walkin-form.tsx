"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api/client";
import { useBarberServices } from "@/lib/api/barber-queries";
import { useBarbers, useAvailability } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";

export function WalkinForm() {
  const client = useQueryClient();
  const today = useShopDate();
  const barbers = useBarbers();
  const [barber, setBarber] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  const services = useBarberServices();
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
      setFeedback("Walk-in registered. The time is now blocked for online booking.");
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
        <label className="block space-y-1 text-sm">
          <span>Professional</span>
          <select
            value={barber}
            onChange={(event) => {
              setBarber(event.target.value);
              setService("");
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">Choose…</option>
            {(barbers.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Service</span>
          <select
            value={service}
            onChange={(event) => {
              setService(event.target.value);
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">Choose…</option>
            {(services.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.price} UZS
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setStart("");
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Available start time</span>
          <select
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">Choose…</option>
            {(slots.data ?? []).map((slot) => (
              <option key={slot.start} value={slot.start}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        {slots.isFetching ? <p className="text-xs text-muted-foreground">Checking availability…</p> : null}
        {!service ? (
          <p className="text-xs text-muted-foreground">Choose a service to see real slots.</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Customer</h2>
        <label className="block space-y-1 text-sm">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Phone (+998)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998 90 123 45 67"
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Internal note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        {feedback ? (
          <p className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">{feedback}</p>
        ) : null}
        <button
          type="button"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate()}
          className="rounded-xl bg-brand px-4 py-2 text-sm text-brand-foreground disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Register walk-in"}
        </button>
      </section>
    </div>
  );
}
