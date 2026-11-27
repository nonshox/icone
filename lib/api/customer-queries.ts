"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  BookingRow,
  Locale,
  Notification,
  NotificationPrefs,
  Profile,
  Status,
} from "@/lib/domain/types";
import { STATUS_LABEL } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export const customerKeys = {
  favorites: ["favorites"] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
};

export type Favorite = {
  id: string;
  barber: string;
  user: string;
  created: string;
  name?: string;
  photo?: string;
};

export type NotificationInbox = {
  notifications: Notification[];
  unread: number;
};

export type SettingsData = {
  profile: Profile;
  prefs: NotificationPrefs;
};

export type CustomerStats = {
  upcoming: number;
  completed: number;
  cancelled: number;
  favorites: number;
  reviews: number;
  unread: number;
};

export type CustomerActivity = {
  id: string;
  kind: "booking" | "review" | "notification";
  title: string;
  detail: string;
  created: string;
};

type ToggleResult = { saved: boolean; favorite: Favorite | null };

export function useFavorites(initial?: Favorite[]) {
  return useQuery({
    queryKey: customerKeys.favorites,
    queryFn: () =>
      api<{ favorites: Favorite[] }>("/api/favorites").then((r) => r.favorites),
    initialData: initial,
    staleTime: 30_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (barber: string) =>
      api<ToggleResult>("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ barber }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.favorites });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (barber: string) =>
      api<{ ok: true }>(`/api/favorites?barber=${encodeURIComponent(barber)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.favorites });
    },
  });
}

export function useNotifications(initial?: NotificationInbox) {
  return useQuery({
    queryKey: customerKeys.notifications,
    queryFn: () => api<NotificationInbox>("/api/notifications?limit=50"),
    initialData: initial,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; all?: boolean }) =>
      api<{ count: number }>("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.notifications });
    },
  });
}

export function useSettings(initial?: SettingsData) {
  return useQuery({
    queryKey: customerKeys.settings,
    queryFn: () => api<SettingsData>("/api/settings"),
    initialData: initial,
    staleTime: 30_000,
  });
}

export type SettingsInput = {
  name?: string;
  phone?: string;
  avatar?: string;
  locale?: Locale;
  prefs?: Partial<NotificationPrefs>;
};

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) =>
      api<SettingsData>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.settings });
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

const UPCOMING: Status[] = ["pending", "confirmed"];
const PAST: Status[] = ["cancelled", "noshow", "rejected"];

/**
 * Derive the dashboard numbers from data TanStack already owns. `today` comes
 * from `useShopDate()` so nothing reads the clock during render.
 */
export function useCustomerOverview(input: {
  bookings: BookingRow[];
  favorites: Favorite[];
  inbox: NotificationInbox;
  today: string;
}): {
  stats: CustomerStats;
  nextBooking: BookingRow | null;
  recentBookings: BookingRow[];
  activity: CustomerActivity[];
} {
  const { bookings, favorites, inbox, today } = input;

  return useMemo(() => {
    const byDate = (a: BookingRow, b: BookingRow) =>
      a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1;

    const upcoming = bookings
      .filter((booking) => UPCOMING.includes(booking.status) && booking.date >= today)
      .sort(byDate);

    const newest = (a: { created: string }, b: { created: string }) =>
      a.created < b.created ? 1 : a.created > b.created ? -1 : 0;

    const recentBookings = [...bookings].sort(newest).slice(0, 3);

    const activity: CustomerActivity[] = [
      ...recentBookings.map((booking) => ({
        id: `booking-${booking.id}`,
        kind: "booking" as const,
        title: booking.serviceName,
        detail: `${booking.barberName} · ${STATUS_LABEL[booking.status]}`,
        created: booking.created,
      })),
      ...bookings
        .filter((booking) => booking.reviewed)
        .slice(0, 2)
        .map((booking) => ({
          id: `review-${booking.id}`,
          kind: "review" as const,
          title: "Review posted",
          detail: `Your review of ${booking.barberName} is live.`,
          created: booking.created,
        })),
      ...inbox.notifications.slice(0, 3).map((item) => ({
        id: `notification-${item.id}`,
        kind: "notification" as const,
        title: item.title,
        detail: item.body,
        created: item.created,
      })),
    ]
      .sort(newest)
      .slice(0, 6);

    const stats: CustomerStats = {
      upcoming: upcoming.length,
      completed: bookings.filter((booking) => booking.status === "done").length,
      cancelled: bookings.filter((booking) => PAST.includes(booking.status)).length,
      favorites: favorites.length,
      reviews: bookings.filter((booking) => booking.reviewed).length,
      unread: inbox.unread,
    };

    return {
      stats,
      nextBooking: upcoming[0] ?? null,
      recentBookings,
      activity,
    };
  }, [bookings, favorites, inbox, today]);
}
