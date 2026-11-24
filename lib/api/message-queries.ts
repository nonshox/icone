"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Message, Participant, Thread } from "@/lib/domain/messages";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/domain/payments";

import { api } from "./client";
import { keys } from "./queries";

export const messageKeys = {
  threads: ["messages"] as const,
  thread: (withId: string) => ["messages", withId] as const,
  payment: (bookingId: string) => ["payment", bookingId] as const,
};

export type ThreadData = {
  participant: Participant;
  messages: Message[];
};

export function useThreads() {
  return useQuery({
    queryKey: messageKeys.threads,
    queryFn: () =>
      api<{ threads: Thread[] }>("/api/messages").then((r) => r.threads),
    refetchInterval: 30_000,
  });
}

export function useThread(withId: string | null, conversation?: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(conversation ?? withId ?? ""),
    queryFn: () => {
      const params = new URLSearchParams();
      if (withId) params.set("with", withId);
      if (conversation) params.set("conversation", conversation);
      return api<{ participant: Participant; messages: Message[] }>(
        `/api/messages?${params.toString()}`,
      );
    },
    enabled: Boolean(withId || conversation),
    refetchInterval: 15_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { to: string; body: string }) =>
      api<{ message: Message }>("/api/messages", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.message),
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.threads });
      void queryClient.invalidateQueries({
        queryKey: messageKeys.thread(input.to),
      });
    },
  });
}

export function usePayment(bookingId: string) {
  return useQuery({
    queryKey: messageKeys.payment(bookingId),
    queryFn: () =>
      api<{ payment: Payment | null }>(
        `/api/payments?booking=${encodeURIComponent(bookingId)}`,
      ).then((r) => r.payment),
    enabled: Boolean(bookingId),
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      booking: string;
      status: PaymentStatus;
      method?: PaymentMethod;
    }) =>
      api<{ payment: Payment }>("/api/payments", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.payment),
    onSuccess: (_payment, input) => {
      void queryClient.invalidateQueries({
        queryKey: messageKeys.payment(input.booking),
      });
      void queryClient.invalidateQueries({ queryKey: keys.bookings });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
