"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BookingRow, Review } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export const bookingKeys = {
  detail: (id: string) => ["booking", id] as const,
};

/** One visit with the `reviewed` flag the single-booking route leaves out. */
export function useBooking(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { booking } = await api<{ booking: BookingRow }>(
        `/api/bookings/${encodeURIComponent(id)}`,
      );

      if (booking.reviewed !== undefined) return booking;

      // The list route resolves `reviewed`; reuse its cache when present.
      let list = queryClient.getQueryData<BookingRow[]>(keys.bookings);
      if (!list) {
        try {
          list = (await api<{ bookings: BookingRow[] }>("/api/bookings")).bookings;
        } catch {
          list = [];
        }
      }

      return {
        ...booking,
        reviewed: list.find((row) => row.id === booking.id)?.reviewed ?? false,
      };
    },
    enabled: Boolean(id),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api<{ booking: BookingRow }>(`/api/bookings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancel" }),
      }).then((response) => response.booking),
    onSuccess: (_booking, id) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useReviewBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { booking: string; rate: number; note?: string }) =>
      api<{ review: Review; rating: number }>("/api/reviews", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_result, input) => {
      // Both caches resolve `reviewed`; update them before refetching so the
      // review form does not come back on a stale list read.
      queryClient.setQueryData<BookingRow[]>(keys.bookings, (list) =>
        list?.map((row) =>
          row.id === input.booking ? { ...row, reviewed: true } : row,
        ),
      );
      queryClient.setQueryData<BookingRow>(
        bookingKeys.detail(input.booking),
        (current) => (current ? { ...current, reviewed: true } : current),
      );
      void queryClient.invalidateQueries({
        queryKey: bookingKeys.detail(input.booking),
      });
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}
