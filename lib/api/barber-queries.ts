"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type {
  Barber,
  BookingRow,
  Client,
  Notification,
  NotificationPrefs,
  PortfolioItem,
  Service,
} from "@/lib/domain/types";

import { api } from "./client";

export type {
  Barber,
  BookingRow,
  Client,
  Notification,
  NotificationPrefs,
  PortfolioItem,
  Service,
};

/** The dashboard only reports real counts — no invented revenue. */
export type DashboardData = {
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
  clients: number;
  returning: number;
  rating: number;
  views: number;
};

export type Customer = Client & { visits: number; last: string; name: string };
export type CustomerDetail = Customer & { visits: BookingRow[] };
export type NotificationRow = Notification;
export type PortfolioInput = {
  url: string;
  note?: string;
  group?: string;
  featured?: boolean;
  public?: boolean;
};
export type ServiceInput = {
  name: string;
  note?: string;
  price: number;
  time: number;
  buffer?: number;
  category?: string;
  active?: boolean;
};
export type ServicePatch = Partial<ServiceInput> & { id: string };
export type PortfolioPatch = Partial<PortfolioInput> & { id: string };
export type SettingsPatch = {
  profile?: Partial<Barber>;
  prefs?: Partial<NotificationPrefs>;
};

export const barberKeys = {
  dashboard: ["barber", "dashboard"] as const,
  services: ["barber", "services"] as const,
  customers: ["barber", "customers"] as const,
  customer: (id: string) => ["barber", "customers", id] as const,
  portfolio: ["barber", "portfolio"] as const,
  notifications: ["barber", "notifications"] as const,
  settings: ["barber", "settings"] as const,
};

function refresh(client: QueryClient, catalogue = false) {
  void client.invalidateQueries({ queryKey: ["barber"] });
  if (catalogue) {
    void client.invalidateQueries({ queryKey: ["barbers"] });
    void client.invalidateQueries({ queryKey: ["services"] });
  }
}

/* ------------------------------------------------------------------ reads */

export function useBarberDashboard() {
  return useQuery({
    queryKey: barberKeys.dashboard,
    queryFn: () =>
      api<{ dashboard: DashboardData }>("/api/barber/dashboard").then(
        (r) => r.dashboard,
      ),
    refetchInterval: 60_000,
  });
}

export function useBarberServices() {
  return useQuery({
    queryKey: barberKeys.services,
    queryFn: () =>
      api<{ services: Service[] }>("/api/barber/services").then((r) => r.services),
  });
}

export function useBarberCustomers() {
  return useQuery({
    queryKey: barberKeys.customers,
    queryFn: () =>
      api<{ customers: Customer[] }>("/api/barber/customers").then(
        (r) => r.customers,
      ),
  });
}

export function useBarberCustomer(id: string) {
  return useQuery({
    queryKey: barberKeys.customer(id),
    queryFn: () =>
      api<{ customer: CustomerDetail }>(
        `/api/barber/customers?id=${encodeURIComponent(id)}`,
      ).then((r) => r.customer),
    enabled: Boolean(id),
  });
}

export function useBarberPortfolio() {
  return useQuery({
    queryKey: barberKeys.portfolio,
    queryFn: () =>
      api<{ items: PortfolioItem[] }>("/api/barber/portfolio").then(
        (r) => r.items,
      ),
  });
}

export function useBarberNotifications() {
  return useQuery({
    queryKey: barberKeys.notifications,
    queryFn: () =>
      api<{ notifications: NotificationRow[] }>("/api/barber/notifications").then(
        (r) => r.notifications,
      ),
    refetchInterval: 60_000,
  });
}

export function useBarberSettings() {
  return useQuery({
    queryKey: barberKeys.settings,
    queryFn: () =>
      api<{ barber: Barber; prefs: NotificationPrefs }>("/api/barber/settings"),
  });
}

/* ----------------------------------------------------------------- writes */

export function useCreateBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      api<{ service: Service }>("/api/barber/services", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.service),
    onSuccess: () => refresh(client, true),
  });
}

export function useUpdateBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ServicePatch) =>
      api<{ service: Service }>("/api/barber/services", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.service),
    onSuccess: () => refresh(client, true),
  });
}

export function useDeleteBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/barber/services?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, true),
  });
}

export function useSaveBarberNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { client: string; note: string }) =>
      api<{ client: Client }>("/api/barber/customers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.client),
    onSuccess: () => refresh(client),
  });
}

export function useCreateBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioInput) =>
      api<{ item: PortfolioItem }>("/api/barber/portfolio", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.item),
    onSuccess: () => refresh(client, true),
  });
}

export function useUpdateBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioPatch) =>
      api<{ item: PortfolioItem }>("/api/barber/portfolio", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.item),
    onSuccess: () => refresh(client, true),
  });
}

export function useDeleteBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/barber/portfolio?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, true),
  });
}

export function useMarkBarberNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ notification: NotificationRow }>("/api/barber/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      }).then((r) => r.notification),
    onSuccess: () => refresh(client),
  });
}

export function useMarkAllBarberNotifications() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ changed: number }>("/api/barber/notifications", {
        method: "PATCH",
        body: JSON.stringify({ all: true }),
      }).then((r) => r.changed),
    onSuccess: () => refresh(client),
  });
}

export function useUpdateBarberSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsPatch) =>
      api<{ barber: Barber; prefs: NotificationPrefs }>("/api/barber/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client, true),
  });
}
