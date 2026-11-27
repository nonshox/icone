"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Barber,
  BookingRow,
  BreakRow,
  DayRow,
  HourRow,
  PortfolioItem,
  Review,
  Role,
  Service,
  Status,
} from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { BookingRow, Service, Status } from "@/lib/domain/types";

/** Shapes returned by the admin routes. Kept here so client hooks stay typed. */
export type AdminBarber = Barber;
export type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  avatar: string;
  locale: string;
  state: "active" | "suspended";
  created?: string;
  barber?: string;
};
export type Announcement = { title: string; body: string; created?: string };
export type Audience = "all" | "clients" | "barbers" | "businesses";
export type BookingDetail = {
  booking: BookingRow;
  review: Record<string, unknown> | null;
  history: Array<Record<string, unknown>>;
};
export type Category = { id: string; name: string; active: boolean };
export type DashboardData = Record<string, number | string>;
export type DayOverride = DayRow;
export type Hour = HourRow;
export type ReportData = { points: ReportPoint[]; total?: number };
export type ReportPoint = { label: string; value: number };
export type { BreakRow, PortfolioItem, Review };

export type NewBarber = { name: string; title: string; bio: string };
export type NewService = {
  name: string;
  note: string;
  price: number;
  time: number;
  /** One of barber or business is required by the admin route. */
  barber?: string;
  business?: string;
};
export type NewHour = { barber: string; day: number; start: number; end: number };
export type NewDay = {
  barber: string;
  date: string;
  open: boolean;
  start: number;
  end: number;
  note: string;
};

export type AdminReview = {
  id: string;
  user: string;
  barber: string;
  booking: string;
  rate: number;
  note: string;
  created: string;
};

export const adminKeys = {
  barbers: ["admin", "barbers"] as const,
  services: ["admin", "services"] as const,
  hours: ["admin", "hours"] as const,
  days: ["admin", "days"] as const,
  reviews: ["admin", "reviews"] as const,
  users: ["admin", "users"] as const,
  dashboard: ["admin", "dashboard"] as const,
  reports: (days: number) => ["admin", "reports", days] as const,
  appointments: (filter: AppointmentFilter) =>
    [
      "admin",
      "appointments",
      filter.status ?? "",
      filter.date ?? "",
      filter.barber ?? "",
    ] as const,
  appointmentDetail: (id: string) => ["admin", "appointment", id] as const,
  portfolio: (barber: string) => ["admin", "portfolio", barber] as const,
  categories: ["admin", "categories"] as const,
  announcements: ["admin", "announcements"] as const,
};

export type AppointmentFilter = {
  status?: string;
  date?: string;
  barber?: string;
};

/* ------------------------------------------------------------------ reads */

export function useAdminBarbers() {
  return useQuery({
    queryKey: adminKeys.barbers,
    queryFn: () =>
      api<{ barbers: AdminBarber[] }>("/api/admin/barbers").then(
        (result) => result.barbers,
      ),
  });
}

export function useAdminServices() {
  return useQuery({
    queryKey: adminKeys.services,
    queryFn: () =>
      api<{ services: Service[] }>("/api/admin/services").then(
        (result) => result.services,
      ),
  });
}

export function useAdminHours() {
  return useQuery({
    queryKey: adminKeys.hours,
    queryFn: () =>
      api<{ hours: Hour[] }>("/api/admin/hours").then((result) => result.hours),
  });
}

export function useAdminDays() {
  return useQuery({
    queryKey: adminKeys.days,
    queryFn: () =>
      api<{ days: DayOverride[] }>("/api/admin/days").then((result) => result.days),
  });
}

export function useAdminReviews() {
  return useQuery({
    queryKey: adminKeys.reviews,
    queryFn: () =>
      api<{ reviews: AdminReview[] }>("/api/admin/reviews").then(
        (result) => result.reviews,
      ),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: () =>
      api<{ users: AdminUser[] }>("/api/admin/users").then(
        (result) => result.users,
      ),
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard,
    queryFn: () =>
      api<{ stats: DashboardData }>("/api/admin/dashboard").then(
        (result) => result.stats,
      ),
    staleTime: 60_000,
  });
}

export function useAdminReports(days: number) {
  return useQuery({
    queryKey: adminKeys.reports(days),
    queryFn: () =>
      api<{ report: ReportData }>(`/api/admin/reports?days=${days}`).then(
        (result) => result.report,
      ),
  });
}

export function useAdminAppointments(filter: AppointmentFilter = {}) {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.date) params.set("date", filter.date);
  if (filter.barber) params.set("barber", filter.barber);
  const suffix = params.toString();

  return useQuery({
    queryKey: adminKeys.appointments(filter),
    queryFn: () =>
      api<{ bookings: BookingRow[] }>(
        `/api/admin/appointments${suffix ? `?${suffix}` : ""}`,
      ).then((result) => result.bookings),
  });
}

export function useAdminAppointmentDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.appointmentDetail(id ?? ""),
    queryFn: () =>
      api<{ detail: BookingDetail }>(
        `/api/admin/appointments/${encodeURIComponent(id ?? "")}`,
      ).then((result) => result.detail),
    enabled: Boolean(id),
  });
}

export function useAdminPortfolio(barber = "") {
  const suffix = barber ? `?barber=${encodeURIComponent(barber)}` : "";
  return useQuery({
    queryKey: adminKeys.portfolio(barber),
    queryFn: () =>
      api<{ items: PortfolioItem[] }>(`/api/admin/portfolio${suffix}`).then(
        (result) => result.items,
      ),
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: adminKeys.categories,
    queryFn: () =>
      api<{ categories: Category[] }>("/api/admin/categories").then(
        (result) => result.categories,
      ),
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: adminKeys.announcements,
    queryFn: () =>
      api<{ announcements: Announcement[] }>("/api/admin/announcements").then(
        (result) => result.announcements,
      ),
  });
}

/* ----------------------------------------------------------------- writes */

export function useCreateBarber() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewBarber) =>
      api<{ barber: AdminBarber }>("/api/admin/barbers", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.barber),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.barbers });
      void client.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}

export function useSetBarberActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      api<{ barber: AdminBarber }>("/api/admin/barbers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.barber),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.barbers });
      void client.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}

export type BarberEdit = {
  id: string;
  name?: string;
  title?: string;
  bio?: string;
  photo?: string;
  cover?: string;
  shop?: string;
  address?: string;
  city?: string;
  years?: number;
  skills?: string;
  phone?: string;
  social?: string;
  facilities?: string;
  policy?: string;
  confirm?: boolean;
  featured?: boolean;
  user?: string;
};

export function useUpdateBarber() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BarberEdit) =>
      api<{ barber: AdminBarber }>("/api/admin/barbers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.barber),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.barbers });
      void client.invalidateQueries({ queryKey: adminKeys.users });
      void client.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}

export function useCreateService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewService) =>
      api<{ service: Service }>("/api/admin/services", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.service),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.services });
      void client.invalidateQueries({ queryKey: keys.services });
    },
  });
}

export function useSetServiceActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      api<{ service: Service }>("/api/admin/services", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.service),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.services });
      void client.invalidateQueries({ queryKey: keys.services });
    },
  });
}

export type ServiceEdit = {
  id: string;
  name?: string;
  note?: string;
  price?: number;
  time?: number;
};

export function useUpdateService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceEdit) =>
      api<{ service: Service }>("/api/admin/services", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.service),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.services });
      void client.invalidateQueries({ queryKey: keys.services });
    },
  });
}

export function useCreateHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewHour) =>
      api<{ hour: Hour }>("/api/admin/hours", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.hour),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.hours });
    },
  });
}

export function useDeleteHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/admin/hours?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.hours });
    },
  });
}

export function useSaveDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewDay) =>
      api<{ day: DayOverride }>("/api/admin/days", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.day),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.days });
    },
  });
}

export function useDeleteDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/admin/days?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.days });
    },
  });
}

export function useDeleteReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/admin/reviews?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.reviews });
      void client.invalidateQueries({ queryKey: ["reviews"] });
      void client.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}

export function useSetUserRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: Role }) =>
      api<{ ok: true }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users });
      void client.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useLinkBarberUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; barber: string }) =>
      api<{ ok: true }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users });
      void client.invalidateQueries({ queryKey: adminKeys.barbers });
      void client.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}

export function useSetUserStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; active: boolean }) =>
      api<{ ok: true }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.users });
      void client.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
}

export function useSetBarberFeatured() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; featured: boolean }) =>
      api<{ barber: AdminBarber }>("/api/admin/barbers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.barber),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.barbers });
      void client.invalidateQueries({ queryKey: keys.barbers });
      void client.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
}

export function useSetAppointmentStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: Status }) =>
      api<{ booking: BookingRow }>("/api/admin/appointments", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.booking),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "appointments"] });
      void client.invalidateQueries({ queryKey: ["admin", "appointment"] });
      void client.invalidateQueries({ queryKey: adminKeys.dashboard });
      void client.invalidateQueries({ queryKey: ["admin", "reports"] });
      void client.invalidateQueries({ queryKey: keys.bookings });
      void client.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function useDeletePortfolioItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/admin/portfolio?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "portfolio"] });
    },
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ category: Category }>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then((result) => result.category),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories });
    },
  });
}

export function useRenameCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api<{ category: Category }>("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.category),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories });
      void client.invalidateQueries({ queryKey: keys.services });
    },
  });
}

export function useSetCategoryActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      api<{ category: Category }>("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.category),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories });
    },
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories });
    },
  });
}

export function useSendAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; audience: Audience }) =>
      api<{ sent: number }>("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.sent),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.announcements });
    },
  });
}

export function useRefreshAdmin() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["admin"] });
  };
}
