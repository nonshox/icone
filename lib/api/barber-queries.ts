"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type {
  BusinessProfileInput,
  Customer,
  CustomerDetail,
  DashboardData,
  EarningsData,
  EarningsFilter,
  NotificationPrefs,
  NotificationRow,
  PortfolioInput,
  PortfolioItem,
  Promotion,
  PromotionInput,
  ServiceInput,
} from "@/lib/domain/barber-business";
import type { Barber, Service } from "@/lib/domain/types";

import { api } from "./client";

export type {
  Activity,
  Appointment,
  BusinessProfileInput,
  CalendarDay,
  Customer,
  CustomerDetail,
  DashboardData,
  EarningsData,
  EarningsFilter,
  NotificationPrefs,
  NotificationRow,
  PortfolioInput,
  PortfolioItem,
  Promotion,
  PromotionInput,
  ServiceInput,
} from "@/lib/domain/barber-business";
export type { Barber, Service } from "@/lib/domain/types";

export type ServicePatch = Partial<ServiceInput> & { id: string };
export type PromotionPatch = Partial<PromotionInput> & { id: string };
export type PortfolioPatch = Partial<PortfolioInput> & { id: string };
export type SettingsPatch = {
  profile?: BusinessProfileInput;
  prefs?: Partial<NotificationPrefs>;
};

export const barberKeys = {
  dashboard: ["barber", "dashboard"] as const,
  services: ["barber", "services"] as const,
  customers: ["barber", "customers"] as const,
  customer: (id: string) => ["barber", "customers", id] as const,
  earnings: (filter: EarningsFilter) =>
    ["barber", "earnings", filter.from, filter.to, filter.service, filter.status] as const,
  promotions: ["barber", "promotions"] as const,
  portfolio: ["barber", "portfolio"] as const,
  notifications: ["barber", "notifications"] as const,
  settings: ["barber", "settings"] as const,
};

function refresh(client: QueryClient, catalogue = false) {
  void client.invalidateQueries({ queryKey: ["barber"] });
  if (catalogue) {
    void client.invalidateQueries({ queryKey: ["barbers"] });
    void client.invalidateQueries({ queryKey: ["services"] });
    void client.invalidateQueries({ queryKey: ["staff", "chair"] });
  }
}

/* ------------------------------------------------------------------ reads */

export function useBarberDashboard() {
  return useQuery({
    queryKey: barberKeys.dashboard,
    queryFn: () => api<{ dashboard: DashboardData }>("/api/barber/dashboard").then((r) => r.dashboard),
    refetchInterval: 60_000,
  });
}

export function useBarberServices() {
  return useQuery({
    queryKey: barberKeys.services,
    queryFn: () => api<{ services: Service[] }>("/api/barber/services").then((r) => r.services),
  });
}

export function useBarberCustomers() {
  return useQuery({
    queryKey: barberKeys.customers,
    queryFn: () => api<{ customers: Customer[] }>("/api/barber/customers").then((r) => r.customers),
  });
}

export function useBarberCustomer(id: string) {
  return useQuery({
    queryKey: barberKeys.customer(id),
    queryFn: () =>
      api<{ customer: CustomerDetail }>(`/api/barber/customers?id=${encodeURIComponent(id)}`).then(
        (r) => r.customer,
      ),
    enabled: Boolean(id),
  });
}

export function useBarberEarnings(filter: EarningsFilter) {
  return useQuery({
    enabled: Boolean(filter.from && filter.to),
    queryKey: barberKeys.earnings(filter),
    queryFn: () =>
      api<{ earnings: EarningsData }>(
        `/api/barber/earnings?from=${filter.from}&to=${filter.to}&service=${encodeURIComponent(filter.service)}&status=${filter.status}`,
      ).then((r) => r.earnings),
  });
}

export function useBarberPromotions() {
  return useQuery({
    queryKey: barberKeys.promotions,
    queryFn: () =>
      api<{ promotions: Promotion[] }>("/api/barber/promotions").then((r) => r.promotions),
  });
}

export function useBarberPortfolio() {
  return useQuery({
    queryKey: barberKeys.portfolio,
    queryFn: () =>
      api<{ items: PortfolioItem[] }>("/api/barber/portfolio").then((r) => r.items),
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
      api<{ chair: Barber; prefs: NotificationPrefs }>("/api/barber/settings"),
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
    mutationFn: (input: { userId: string; note: string }) =>
      api<{ note: unknown }>("/api/barber/customers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.note),
    onSuccess: () => refresh(client),
  });
}

export function useCreateBarberPromotion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PromotionInput) =>
      api<{ promotion: Promotion }>("/api/barber/promotions", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.promotion),
    onSuccess: () => refresh(client, true),
  });
}

export function useUpdateBarberPromotion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PromotionPatch) =>
      api<{ promotion: Promotion }>("/api/barber/promotions", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.promotion),
    onSuccess: () => refresh(client, true),
  });
}

export function useDeleteBarberPromotion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/barber/promotions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, true),
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
      api<{ chair: Barber; prefs: NotificationPrefs }>("/api/barber/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client, true),
  });
}
