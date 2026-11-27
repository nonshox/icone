"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Barber, BreakRow, DayRow, HourRow } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { Barber, BreakRow, DayRow, HourRow } from "@/lib/domain/types";

/** A recurring break with the document id needed to delete it. */
export type StaffBreak = BreakRow & { id: string; barber: string };

export type MyChairData = {
  barber: Barber | null;
  hours: HourRow[];
  days: DayRow[];
  breaks: StaffBreak[];
};

export type HourInput = { day: number; start: number; end: number };
export type BreakInput = {
  day: number;
  start: number;
  end: number;
  note: string;
};
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
  breaks: ["staff", "breaks"] as const,
};

function refresh(client: QueryClient) {
  void client.invalidateQueries({ queryKey: staffKeys.chair });
  void client.invalidateQueries({ queryKey: staffKeys.hours });
  void client.invalidateQueries({ queryKey: staffKeys.days });
  void client.invalidateQueries({ queryKey: staffKeys.breaks });
  void client.invalidateQueries({ queryKey: ["agenda"] });
  void client.invalidateQueries({ queryKey: ["availability"] });
  void client.invalidateQueries({ queryKey: ["availability-quote"] });
  void client.invalidateQueries({ queryKey: keys.barbers });
}

export function useMyChair() {
  return useQuery({
    queryKey: staffKeys.chair,
    queryFn: async (): Promise<MyChairData> => {
      const [settings, hours, days, breaks] = await Promise.all([
        api<{ barber: Barber | null }>("/api/barber/settings"),
        api<{ hours: HourRow[] }>("/api/staff/hours"),
        api<{ days: DayRow[] }>("/api/staff/days"),
        api<{ breaks: StaffBreak[] }>("/api/staff/breaks"),
      ]);
      return {
        barber: settings.barber,
        hours: hours.hours,
        days: days.days,
        breaks: breaks.breaks,
      };
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

/** Add a recurring break on the actor's own chair or branch. */
export function useCreateMyBreak() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BreakInput) =>
      api<{ ok: true }>("/api/staff/breaks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => refresh(client),
  });
}

/** Remove one recurring break by document id. */
export function useDeleteMyBreak() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/staff/breaks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client),
  });
}
