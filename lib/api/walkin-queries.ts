"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BookingRow, OfferedService } from "@/lib/domain/types";

import { api } from "./client";

export type WalkinSource = "walkin" | "phone" | "manual";

export type WalkinInput = {
  barber: string;
  services: string[];
  date: string;
  start: number;
  /** Existing client record id (or a member id without a CRM row). */
  client?: string;
  /** Signed-in member id, when booking for a real account. */
  user?: string;
  name?: string;
  phone?: string;
  note?: string;
  source: WalkinSource;
};

/**
 * Services one employee really offers, with the per-employee price and
 * duration already resolved by `servicesFor`. This is the professional-side
 * equivalent of the public availability catalogue.
 */
export function useWalkinServices(barber: string) {
  return useQuery({
    queryKey: ["walkin", "services", barber],
    queryFn: () =>
      api<{ services: OfferedService[] }>(
        `/api/barber/services?barber=${encodeURIComponent(barber)}`,
      ).then((response) => response.services),
    enabled: Boolean(barber),
    staleTime: 5 * 60_000,
  });
}

/** One mutation for every professional-side visit, whatever its source. */
export function useCreateWalkin() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: WalkinInput) =>
      api<{ booking: BookingRow }>("/api/walkins", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((response) => response.booking),
    onSuccess: () => {
      for (const prefix of [
        "agenda",
        "availability",
        "availability-quote",
        "barber",
        "bookings",
        "customers",
        "analytics",
      ]) {
        void client.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });
}
