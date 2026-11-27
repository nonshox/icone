"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Barber, DayRow, HourRow } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { Barber, DayRow, HourRow } from "@/lib/domain/types";

export type MyChairData = {
  barber: Barber | null;
  hours: HourRow[];
  days: DayRow[];
};

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
  hours: ["staff", "hours"] as const,
  days: ["staff", "days"] as const,
};

function refresh(client: QueryClient) {
  void client.invalidateQueries({ queryKey: staffKeys.chair });
  void client.invalidateQueries({ queryKey: staffKeys.hours });
  void client.invalidateQueries({ queryKey: staffKeys.days });
  void client.invalidateQueries({ queryKey: ["agenda"] });
  void client.invalidateQueries({ queryKey: ["availability"] });
  void client.invalidateQueries({ queryKey: ["availability-quote"] });
  void client.invalidateQueries({ queryKey: keys.barbers });
}

export function useMyChair() {
  return useQuery({
    queryKey: staffKeys.chair,
    queryFn: async (): Promise<MyChairData> => {
      const [settings, hours, days] = await Promise.all([
        api<{ barber: Barber | null }>("/api/barber/settings"),
        api<{ hours: HourRow[] }>("/api/staff/hours"),
        api<{ days: DayRow[] }>("/api/staff/days"),
      ]);
      return { barber: settings.barber, hours: hours.hours, days: days.days };
    },
  });
}

export function useCreateMyHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: HourInput) =>
      api<{ ok: true }>("/api/staff/hours", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client),
  });
}

export function useDeleteMyHour() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { day: number; start: number }) =>
      api<{ ok: true }>("/api/staff/hours", {
        method: "DELETE",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client),
  });
}

export function useSaveMyDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DayInput) =>
      api<{ ok: true }>("/api/staff/days", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client),
  });
}

export function useDeleteMyDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api<{ ok: true }>("/api/staff/days", {
        method: "DELETE",
        body: JSON.stringify({ date }),
      }),
    onSuccess: () => refresh(client),
  });
}

/** Copy the current weekly template onto next week. The owner is server-side. */
export function useCloneWeek() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/api/staff/clone", { method: "POST" }),
    onSuccess: () => refresh(client),
  });
}
