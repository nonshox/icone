"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminBarber, DayOverride, Hour } from "@/lib/domain/admin";
import type { Service } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { AdminBarber, DayOverride, Hour } from "@/lib/domain/admin";
export type { Service } from "@/lib/domain/types";

export type NewBarber = { name: string; title: string; bio: string };
export type NewService = {
  name: string;
  note: string;
  price: number;
  time: number;
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
