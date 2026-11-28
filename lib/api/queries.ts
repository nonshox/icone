"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SessionUser } from "@/lib/auth/types";
import type {
  Barber,
  BookingRow,
  Profile,
  Review,
  Service,
  Slot,
  Status,
} from "@/lib/domain/types";

import { api } from "./client";

export const keys = {
  barbers: ["barbers"] as const,
  services: ["services"] as const,
  availability: (barber: string, date: string, services: string[]) =>
    ["availability", barber, date, [...services]] as const,
  availabilityQuote: (
    barber: string,
    date: string,
    services: string[],
    scope = "",
  ) => ["availability-quote", barber, date, [...services], scope] as const,
  bookings: ["bookings"] as const,
  booking: (id: string) => ["booking", id] as const,
  agenda: (date: string, barber: string) => ["agenda", date, barber] as const,
  reviews: (barber: string) => ["reviews", barber] as const,
  me: ["me"] as const,
};

export function useBarbers() {
  return useQuery({
    queryKey: keys.barbers,
    queryFn: () => api<{ barbers: Barber[] }>("/api/barbers").then((r) => r.barbers),
    staleTime: 5 * 60_000,
  });
}

export function useServices() {
  return useQuery({
    queryKey: keys.services,
    queryFn: () =>
      api<{ services: Service[] }>("/api/services").then((r) => r.services),
    staleTime: 5 * 60_000,
  });
}

export type AvailabilityInput = {
  barber: string;
  date: string;
  /** Every service in the visit. The whole duration is used for the slots. */
  services?: string[];
  /** Legacy single-service callers keep working unchanged. */
  service?: string;
  /** Server picks the first qualified employee in this business/branch. */
  any?: boolean;
  business?: string;
  branch?: string;
};

/** The server's answer for a whole visit: real slots plus resolved totals. */
export type AvailabilityQuote = {
  /** The employee the server matched when `any` was requested. */
  barber?: string;
  barberName?: string;
  slots: Slot[];
  /** Total minutes the visit occupies, buffer included. */
  time: number;
  /** Total price in UZS for this barber's offer. */
  price: number;
  services: Array<{ id: string; name: string; price: number; time: number }>;
};

function availabilityIds(input: AvailabilityInput): string[] {
  const ids = input.services?.length
    ? input.services
    : input.service
      ? [input.service]
      : [];
  return [...new Set(ids.filter(Boolean))];
}

/**
 * One canonical query string for every availability read. Exported so the
 * booking form's recovery searches use exactly the same grammar as the hooks.
 */
export function availabilityQuery(input: AvailabilityInput, ids: string[]): string {
  const query = new URLSearchParams({ barber: input.barber, date: input.date });
  if (input.any) {
    query.set("barber", "any");
    query.set("any", "1");
    if (input.business) query.set("business", input.business);
    if (input.branch) query.set("branch", input.branch);
  }
  ids.forEach((id) => query.append("services", id));
  return query.toString();
}

/** Slots only — the shape older callers expect. */
export function useAvailability(input: AvailabilityInput) {
  const ids = availabilityIds(input);
  return useQuery({
    queryKey: keys.availability(input.barber, input.date, ids),
    queryFn: () =>
      api<{ slots: Slot[] }>(`/api/availability?${availabilityQuery(input, ids)}`).then(
        (r) => r.slots,
      ),
    enabled: Boolean(input.barber && input.date && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Slots plus the server-resolved price and duration of the whole visit. */
export function useAvailabilityQuote(input: AvailabilityInput) {
  const ids = availabilityIds(input);
  return useQuery({
    queryKey: keys.availabilityQuote(
      input.barber,
      input.date,
      ids,
      `${input.business ?? ""}|${input.branch ?? ""}`,
    ),
    queryFn: () =>
      api<AvailabilityQuote>(`/api/availability?${availabilityQuery(input, ids)}`),
    enabled: Boolean(input.barber && input.date && ids.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useBookings() {
  return useQuery({
    queryKey: keys.bookings,
    queryFn: () =>
      api<{ bookings: BookingRow[] }>("/api/bookings").then((r) => r.bookings),
  });
}

/**
 * One day of the staff calendar. An empty `barber` lets the server scope the
 * agenda to the signed-in professional (or every chair for an admin).
 */
export function useAgenda(date: string, barber = "") {
  return useQuery({
    queryKey: keys.agenda(date, barber),
    queryFn: () =>
      api<{ bookings: BookingRow[] }>(
        `/api/bookings?date=${date}${barber ? `&barber=${barber}` : ""}`,
      ).then((r) => r.bookings),
    enabled: Boolean(date),
    // Day/week/month cells share cached dates; switching views reuses them.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useReviews(barber: string) {
  return useQuery({
    queryKey: keys.reviews(barber),
    queryFn: () =>
      api<{ reviews: Review[] }>(`/api/reviews?barber=${barber}`).then(
        (r) => r.reviews,
      ),
    enabled: Boolean(barber),
  });
}

/** The full /api/me response, including the professional membership signal. */
export type MeResponse = {
  profile: Profile;
  user: SessionUser | null;
  /** True when the account has an approved professional row or membership. */
  professional: boolean;
  /** First business this account owns, or "" for an independent barber. */
  businessId: string;
};

/** Shared cached read behind both the role-aware navigation and the profile. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<MeResponse>("/api/me"),
    // A 401 for a guest is expected, not a failed request worth retrying.
    retry: false,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<MeResponse>("/api/me"),
    select: (response) => response.profile,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      barber: string;
      /** Every service in the visit, in performance order. */
      services: string[];
      date: string;
      start: number;
      note?: string;
    }) =>
      api<{ booking: BookingRow }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.booking),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-quote"] });
    },
  });
}

export function useSetStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; status: Status }) =>
      api<{ booking: BookingRow }>(`/api/bookings/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status }),
      }).then((r) => r.booking),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-quote"] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string; phone?: string }) =>
      api<{ profile: Profile }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** The only review mutation. Both visit views share it. */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { booking: string; rate: number; note?: string }) =>
      api<{ review: Review; rating: number }>("/api/reviews", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_result, input) => {
      // Mark both caches before refetching so the review form does not flash
      // back on a stale list read.
      queryClient.setQueryData<BookingRow[]>(keys.bookings, (list) =>
        list?.map((row) =>
          row.id === input.booking ? { ...row, reviewed: true } : row,
        ),
      );
      queryClient.setQueryData<BookingRow>(keys.booking(input.booking), (row) =>
        row ? { ...row, reviewed: true } : row,
      );
      void queryClient.invalidateQueries({
        queryKey: keys.booking(input.booking),
      });
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: keys.barbers });
    },
  });
}
