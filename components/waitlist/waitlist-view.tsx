"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { T } from "@/components/i18n/t";
import { api } from "@/lib/api/client";
import { useBarbers } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";

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
  const t = useT();
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
      setFeedback(t("waitlist.joined"));
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
        <h2 className="text-lg font-semibold"><T k="waitlist.title" /></h2>
        <p className="text-sm text-muted-foreground"><T k="waitlist.subtitle" /></p>

        {feedback ? (
          <p role="status" className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">
            {feedback}
          </p>
        ) : null}
        {barbers.isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
            {t("waitlist.loadError")}
          </p>
        ) : null}

        <label className="block space-y-1 text-sm">
          <span><T k="waitlist.professional" /></span>
          <select
            value={barber}
            aria-label={t("waitlist.professional")}
            onChange={(event) => setBarber(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">{t("waitlist.choose")}</option>
            {(barbers.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="waitlist.service" /></span>
          <input
            value={service}
            aria-label={t("waitlist.service")}
            placeholder={t("waitlist.serviceHint")}
            onChange={(event) => setService(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="waitlist.day" /></span>
          <select
            value={day}
            aria-label={t("waitlist.day")}
            onChange={(event) => setDay(Number(event.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value={-1}>{t("waitlist.anyDay")}</option>
            {[0, 1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {t(`day.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span><T k="waitlist.note" /></span>
          <input
            value={note}
            aria-label={t("waitlist.note")}
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
          {join.isPending ? t("common.loading") : t("waitlist.join")}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold"><T k="waitlist.requests" /></h2>
        {waits.isPending ? (
          <div className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden />
        ) : null}
        {waits.isError ? (
          <p role="alert" className="rounded-2xl border border-destructive/40 p-4 text-sm text-destructive">
            {t("waitlist.loadError")}
          </p>
        ) : null}
        {waits.isSuccess && active.length === 0 ? (
          <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            <T k="waitlist.empty" />
          </p>
        ) : null}
        {active.map((wait) => (
          <div
            key={wait.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">
                {barbers.data?.find((row) => row.id === wait.barber)?.name ?? wait.barber}
              </p>
              <p className="text-xs text-muted-foreground">
                {wait.from} – {wait.to} · {t(`waitlist.state.${wait.state}`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => cancel.mutate(wait.id)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              <T k="common.cancel" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
