"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { StaffDay, StaffHour } from "@/lib/domain/staff";
import type { Barber, BookingRow } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { StaffDay, StaffHour } from "@/lib/domain/staff";
export type { Barber, BookingRow } from "@/lib/domain/types";

export type MyChairData = {
  chair: Barber | null;
  hours: StaffHour[];
  days: StaffDay[];
  upcoming?: BookingRow[];
};

export type ChairPatch = { title: string; bio: string; photo: string };
export type HourInput = { day: number; start: number; end: number };
export type DayInput = {
  date: string;
  open: boolean;
  start: number;
  end: number;
  note: string;
};

export const staffKeys = {
  chair: ["staff", "chair"] as const,
  upcoming: (days: number) => ["staff", "upcoming", days] as const,
};

/** Shared invalidation: availability and agenda rows depend on the chair. */
function refresh(client: QueryClient, withCatalogue = true) {
  void client.invalidateQueries({ queryKey: staffKeys.chair });
  void client.invalidateQueries({ queryKey: ["staff", "upcoming"] });
  void client.invalidateQueries({ queryKey: ["agenda"] });
  void client.invalidateQueries({ queryKey: ["availability"] });
  if (withCatalogue) {
    void client.invalidateQueries({ queryKey: keys.barbers });
  }
}

/* ------------------------------------------------------------------ reads */

export function useMyChair() {
  return useQuery({
    queryKey: staffKeys.chair,
    queryFn: () => api<MyChairData>("/api/staff/chair"),
  });
}

export function useMyUpcoming(days: number) {
  return useQuery({
    queryKey: staffKeys.upcoming(days),
    queryFn: () =>
      api<{ upcoming: BookingRow[] }>(`/api/staff/chair?upcoming=${days}`).then(
        (result) => result.upcoming ?? [],
      ),
    refetchInterval: 60_000,
  });
}

/* ----------------------------------------------------------------- writes */

export function useUpdateMyChair() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ChairPatch) =>
      api<{ chair: Barber }>("/api/staff/chair", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.chair),
    onSuccess: () => refresh(client),
  });
}

export function useCreateMyHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: HourInput) =>
      api<{ hour: StaffHour }>("/api/staff/hours", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.hour),
    onSuccess: () => refresh(client, false),
  });
}

export function useDeleteMyHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/staff/hours?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, false),
  });
}

export function useSaveMyDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DayInput) =>
      api<{ day: StaffDay }>("/api/staff/days", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.day),
    onSuccess: () => refresh(client, false),
  });
}

export function useDeleteMyDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/staff/days?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, false),
  });
}
