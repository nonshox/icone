"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export type Application = {
  id: string;
  user: string;
  /** a = independent barber, b = barbershop with a team. */
  model: "a" | "b";
  name: string;
  shop: string;
  city: string;
  address: string;
  phone: string;
  bio: string;
  state: "pending" | "approved" | "rejected" | "draft" | "submitted" | "review" | "info" | "suspended";
  /** Canonical state; `state` is the legacy three-value view. */
  appState?: string;
  note: string;
  created: string;
};

/** The shared shape of the apply form, used by both submit and draft-save. */
export type ApplicationInput = {
  model?: "a" | "b";
  name: string;
  shop: string;
  city: string;
  address: string;
  phone: string;
  bio: string;
};

export const applicationKeys = {
  mine: ["applications", "mine"] as const,
  queue: ["applications", "queue"] as const,
};

export function useMyApplication() {
  return useQuery({
    queryKey: applicationKeys.mine,
    queryFn: () =>
      api<{ application: Application | null }>("/api/applications").then(
        (result) => result.application,
      ),
    // Approval happens in the admin's browser, so this cache cannot be
    // invalidated from there. Poll only while the outcome is still unknown.
    refetchInterval: (query) =>
      ["pending", "draft", "submitted", "review", "info"].includes(
        query.state.data?.appState ?? query.state.data?.state ?? "",
      )
        ? 15_000
        : false,
    refetchOnWindowFocus: true,
  });
}

export function useSubmitApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      api<{ application: Application }>("/api/applications", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.application),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: applicationKeys.mine });
      void client.invalidateQueries({ queryKey: ["me"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
    },
  });
}

/** Save the current form as a draft without entering the review queue. */
export function useSaveApplicationDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      api<{ application: Application }>("/api/applications", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.application),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: applicationKeys.mine });
    },
  });
}

export function useApplications() {
  return useQuery({
    queryKey: applicationKeys.queue,
    queryFn: () =>
      api<{ applications: Application[] }>("/api/admin/applications").then(
        (result) => result.applications,
      ),
  });
}

export function useDecideApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      decision: "approved" | "rejected";
      note?: string;
    }) =>
      api<{ application: Application }>("/api/admin/applications", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((result) => result.application),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: applicationKeys.queue });
      void client.invalidateQueries({ queryKey: applicationKeys.mine });
      void client.invalidateQueries({ queryKey: ["admin", "users"] });
      void client.invalidateQueries({ queryKey: ["me"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
    },
  });
}
