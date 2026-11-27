"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BookingRow } from "@/lib/domain/types";

import { api } from "./client";
import { keys, useCreateReview } from "./queries";

export const bookingKeys = {
  detail: (id: string) => keys.booking(id),
};

/** One visit. The detail route already resolves its `reviewed` flag. */
export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { booking } = await api<{ booking: BookingRow }>(
        `/api/bookings/${encodeURIComponent(id)}`,
      );
      return booking;
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

/** Kept as a named alias so visit views read consistently. */
export const useReviewBooking = useCreateReview;
