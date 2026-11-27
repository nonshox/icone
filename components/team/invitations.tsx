"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api/client";

function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return local.length === 9
    ? `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
    : value;
}

type Invite = {
  id: string;
  business: string;
  role: string;
  to: string;
  phone: string;
  name: string;
  token: string;
  by: string;
  branch: string;
  state: string;
  expires: string;
};

export function Invitations() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const client = useQueryClient();
  const [message, setMessage] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["invites"],
    queryFn: () => api<{ invites: Invite[] }>("/api/invites"),
  });

  const accept = useMutation({
    mutationFn: async (value: string) => {
      const result = await api<{ ok: true }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ token: value }),
      });
      return result.ok;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["invites"] });
      void client.invalidateQueries({ queryKey: ["me"] });
      setMessage("You joined the team.");
    },
    onError: (failure: Error) => setMessage(failure.message),
  });

  const decline = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/invites?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  useEffect(() => {
    if (token && !accept.isPending && !message) {
      accept.mutate(token);
    }
    // A deep link should be accepted once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const invites = (data?.invites ?? []).filter(
    (row) => row.state === "pending",
  );

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-xl border border-brand bg-brand/10 p-3 text-sm">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error.message}
        </div>
      ) : null}
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" aria-hidden />
      ) : null}
      {!isLoading && invites.length === 0 ? (
        <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
          You have no pending invitations.
        </div>
      ) : null}
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div>
            <p className="font-medium">Role: {invite.role}</p>
            <p className="text-sm text-muted-foreground">
              {invite.name || prettyPhone(invite.phone)} · expires {invite.expires}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => accept.mutate(invite.token)}
              disabled={accept.isPending}
              className="rounded-xl bg-brand px-3 py-2 text-sm text-brand-foreground disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => decline.mutate(invite.id)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
