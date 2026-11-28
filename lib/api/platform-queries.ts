"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlatformSettings } from "@/lib/domain/admin";
import type {
  AuditEntry,
  Place,
  Report,
  Review,
  Ticket,
} from "@/lib/domain/types";

import { api } from "./client";

/* ----------------------------------------------------------------- types */

export type ReportKind = "user" | "barber" | "business" | "booking" | "review" | "other";
export type ReportState = Report["state"];
export type TicketState = Ticket["state"];

export type NewReport = {
  kind: ReportKind;
  target: string;
  note: string;
};

export type NewTicket = {
  topic: string;
  body: string;
};

export type ReportResolution = {
  id: string;
  state: ReportState;
  detail?: string;
};

export type TicketUpdate =
  | { id: string; action: "reply"; reply: string }
  | { id: string; action: "close" };

export type AuditFilter = {
  action?: string;
  actor?: string;
  kind?: string;
  target?: string;
  limit?: number;
};

export type Professional = {
  id: string;
  name: string;
  user: string;
  city: string;
  district: string;
  rating: number;
  verified: boolean;
  state: string;
  active: boolean;
  created: string;
};

export type ProfessionalUpdate =
  | {
      id: string;
      kind: "barber";
      verified?: boolean;
      state?: "draft" | "active" | "suspended";
    }
  | {
      id: string;
      kind: "business";
      verified?: boolean;
      state?: "draft" | "review" | "active" | "suspended";
    };

export type NewPlace = {
  name: string;
  kind: "city" | "district";
  parent?: string;
  ru?: string;
  en?: string;
  lat?: number;
  lng?: number;
};

export type PlaceUpdate = { id: string; active: boolean };

export type { AuditEntry, Place, PlatformSettings, Report, Review, Ticket };

/* ------------------------------------------------------------------ keys */

export const platformKeys = {
  moderationReports: (state?: ReportState) =>
    ["platform", "reports", state ?? ""] as const,
  tickets: (state?: TicketState) => ["platform", "tickets", state ?? ""] as const,
  audit: (filter: AuditFilter) =>
    [
      "platform",
      "audit",
      filter.action ?? "",
      filter.actor ?? "",
      filter.kind ?? "",
      filter.target ?? "",
      filter.limit ?? 0,
    ] as const,
  settings: ["platform", "settings"] as const,
  professionals: (verified?: boolean, q?: string) =>
    ["platform", "professionals", verified ?? "", q ?? ""] as const,
  places: ["platform", "places"] as const,
};

function auditQuery(filter: AuditFilter): string {
  const params = new URLSearchParams();
  if (filter.action) params.set("action", filter.action);
  if (filter.actor) params.set("actor", filter.actor);
  if (filter.kind) params.set("kind", filter.kind);
  if (filter.target) params.set("target", filter.target);
  if (filter.limit) params.set("limit", String(filter.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/* ------------------------------------------------------------- member writes */

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: NewReport) =>
      api<{ report: Report }>("/api/reports", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.report),
  });
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: (input: NewTicket) =>
      api<{ ticket: Ticket }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.ticket),
  });
}

export function useReplyReview() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; reply: string }) =>
      api<{ review: Review }>("/api/barber/reviews", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.review),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["reviews"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
    },
  });
}

/* ------------------------------------------------------------- admin reads */

/** Moderation queue reports — distinct from the analytics `useAdminReportAnalytics`. */
export function useModerationReports(state?: ReportState) {
  const suffix = state ? `?state=${encodeURIComponent(state)}` : "";

  return useQuery({
    queryKey: platformKeys.moderationReports(state),
    queryFn: () =>
      api<{ reports: Report[] }>(`/api/admin/reports${suffix}`).then(
        (result) => result.reports,
      ),
  });
}

/** Backwards-compatible alias until every caller uses the canonical name. */
export const useAdminReports = useModerationReports;

export function useAdminTickets(state?: TicketState) {
  const suffix = state ? `?state=${encodeURIComponent(state)}` : "";

  return useQuery({
    queryKey: platformKeys.tickets(state),
    queryFn: () =>
      api<{ tickets: Ticket[] }>(`/api/admin/tickets${suffix}`).then(
        (result) => result.tickets,
      ),
  });
}

export function useAdminAudit(filter: AuditFilter = {}) {
  const suffix = auditQuery(filter);

  return useQuery({
    queryKey: platformKeys.audit(filter),
    queryFn: () =>
      api<{ entries: AuditEntry[]; actions: string[] }>(`/api/admin/audit${suffix}`),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: platformKeys.settings,
    queryFn: () =>
      api<{ settings: PlatformSettings }>("/api/admin/settings").then(
        (result) => result.settings,
      ),
  });
}

export function useAdminProfessionals(verified?: boolean, q?: string) {
  const params = new URLSearchParams();
  if (typeof verified === "boolean") params.set("verified", String(verified));
  if (q) params.set("q", q);
  const suffix = params.toString();

  return useQuery({
    queryKey: platformKeys.professionals(verified, q),
    queryFn: () =>
      api<{ professionals: Professional[] }>(
        `/api/admin/professionals${suffix ? `?${suffix}` : ""}`,
      ).then((result) => result.professionals),
  });
}

export function useAdminPlaces() {
  return useQuery({
    queryKey: platformKeys.places,
    queryFn: () =>
      api<{ places: Place[] }>("/api/admin/places").then((result) => result.places),
  });
}

/* ------------------------------------------------------------- admin writes */

export function useResolveReport() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: ReportResolution) =>
      api<{ ok: true }>("/api/admin/reports", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["platform", "reports"] });
      void client.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

export function useTicketReply() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Extract<TicketUpdate, { action: "reply" }>) =>
      api<{ ok: true }>("/api/admin/tickets", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["platform", "tickets"] });
      void client.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

export function useTicketClose() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Extract<TicketUpdate, { action: "close" }>) =>
      api<{ ok: true }>("/api/admin/tickets", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["platform", "tickets"] });
      void client.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

export function useUpdateAdminSettings() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<PlatformSettings>) =>
      api<{ settings: PlatformSettings }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.settings),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: platformKeys.settings });
    },
  });
}

export function useUpdateProfessional() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfessionalUpdate) =>
      api<{ ok: true }>("/api/admin/professionals", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["platform", "professionals"] });
      void client.invalidateQueries({ queryKey: ["admin", "barbers"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
    },
  });
}

export function useCreatePlace() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: NewPlace) =>
      api<{ ok: true }>("/api/admin/places", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: platformKeys.places });
    },
  });
}

export function useTogglePlace() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: PlaceUpdate) =>
      api<{ ok: true }>("/api/admin/places", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: platformKeys.places });
    },
  });
}
