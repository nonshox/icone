"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export type Application = {
  id: string;
  user: string;
  name: string;
  shop: string;
  city: string;
  address: string;
  phone: string;
  bio: string;
  state: "pending" | "approved" | "rejected";
  note: string;
  created: string;
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
  });
}

export function useSubmitApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      shop: string;
      city: string;
      address: string;
      phone: string;
      bio: string;
    }) =>
      api<{ application: Application }>("/api/applications", {
        method: "POST",
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
      void client.invalidateQueries({ queryKey: ["admin", "users"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
    },
  });
}
