"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Message } from "@/lib/domain/messages";

import { api } from "./client";

export const messageKeys = {
  threads: ["messages"] as const,
  thread: (withId: string) => ["messages", withId] as const,
};

/**
 * The inbox DTO. `id` and `with` are the counterpart's account id;
 * `conversation` is the stable pair key used by the conversation entity.
 */
export type Thread = {
  id: string;
  with: string;
  withName: string;
  withAvatar?: string;
  name: string;
  conversation: string;
  last: string;
  preview: string;
  lastAt: string;
  at?: string;
  unread: number;
};

export type ThreadData = {
  participant: { id: string; name: string };
  messages: Message[];
  conversation?: string;
  unread?: number;
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
      return api<ThreadData>(`/api/messages?${params.toString()}`);
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
    onSuccess: (message, input) => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.threads });
      void queryClient.invalidateQueries({
        queryKey: messageKeys.thread(message.conversation || input.to),
      });
      void queryClient.invalidateQueries({
        queryKey: messageKeys.thread(input.to),
      });
    },
  });
}
