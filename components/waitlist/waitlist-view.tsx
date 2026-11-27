"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api/client";
import { useBarbers } from "@/lib/api/queries";

type Wait = {
  id: string;
  barber: string;
  service: string;
  from: string;
  to: string;
  day: number;
  note: string;
  state: string;
};

export function WaitlistView() {
  const client = useQueryClient();
  const barbers = useBarbers();
  const waits = useQuery({
    queryKey: ["waits"],
    queryFn: () => api<{ waits: Wait[] }>("/api/waits"),
  });

  const [barber, setBarber] = useState("");
  const [service, setService] = useState("");
  const [day, setDay] = useState(-1);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  const join = useMutation({
    mutationFn: () =>
      api<{ wait: Wait }>("/api/waits", {
        method: "POST",
        body: JSON.stringify({
          barber,
          service: service || undefined,
          day,
          note,
        }),
      }).then((result) => result.wait),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["waits"] });
      setFeedback("You are on the list. We will message you when a slot opens.");
      setNote("");
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/waits?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["waits"] }),
  });

  const active = (waits.data?.waits ?? []).filter(
    (row) => row.state === "open" || row.state === "notified",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Join a waitlist</h2>
        <p className="text-sm text-muted-foreground">
          Pick a professional and we will notify you on Telegram when a time
          frees up.
        </p>

        {feedback ? (
          <p className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">
            {feedback}
          </p>
        ) : null}
        {barbers.isError ? (
          <p className="rounded-xl border border-destructive/40 p-3 text-sm">
            Could not load professionals.
          </p>
        ) : null}

        <label className="block space-y-1 text-sm">
          <span>Professional</span>
          <select
            value={barber}
            onChange={(event) => setBarber(event.target.value)}
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
          <span>Service (optional)</span>
          <input
            value={service}
            onChange={(event) => setService(event.target.value)}
            placeholder="Service name or id"
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Preferred day</span>
          <select
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value={-1}>Any day</option>
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
              (name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={!barber || join.isPending}
          onClick={() => join.mutate()}
          className="rounded-xl bg-brand px-4 py-2 text-sm text-brand-foreground disabled:opacity-50"
        >
          {join.isPending ? "Joining…" : "Join waitlist"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your requests</h2>
        {waits.isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden />
        ) : null}
        {!waits.isLoading && active.length === 0 ? (
          <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            You have no open requests.
          </p>
        ) : null}
        {active.map((wait) => (
          <div
            key={wait.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">{wait.barber}</p>
              <p className="text-xs text-muted-foreground">
                {wait.from} – {wait.to} · {wait.state}
              </p>
            </div>
            <button
              type="button"
              onClick={() => cancel.mutate(wait.id)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
