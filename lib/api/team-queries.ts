"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Branch, Invite, Membership, Review, TeamRole } from "@/lib/domain/types";

import { api } from "./client";
import { keys } from "./queries";

export type { Branch, Invite, Membership, Review, TeamRole } from "@/lib/domain/types";

/* ------------------------------------------------------------------ types */

export type TeamData = {
  business: string;
  members: Membership[];
  invites: Invite[];
};

export type InviteInput = {
  role: TeamRole;
  business?: string;
  to?: string;
  phone?: string;
  name?: string;
  branch?: string;
};

export type MemberPatch = {
  id: string;
  business?: string;
  role?: TeamRole;
  active?: boolean;
  branch?: string;
  perms?: Record<string, boolean>;
};

export type TeamDeleteInput = {
  member?: string;
  invite?: string;
  business?: string;
};

export type BranchCreate = {
  name: string;
  business?: string;
  city?: string;
  primary?: boolean;
};

export type BranchPatch = {
  id: string;
  business?: string;
  name?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  lat?: number;
  lng?: number;
  note?: string;
  active?: boolean;
  primary?: boolean;
};

export type BranchDelete = { id: string; business?: string };

export type HistogramRow = { label: string; value: number };
export type AnalyticsRange = { from: string; to: string };
export type AnalyticsKey = "week" | "month" | "quarter";

/** The client mirror of `lib/domain/stats` (that module is server-only). */
export type AnalyticsStats = {
  range: AnalyticsRange;
  total: number;
  completed: number;
  cancelled: number;
  rejected: number;
  noShow: number;
  pending: number;
  confirmed: number;
  held: number;
  noShowRate: number;
  cancelRate: number;
  newCustomers: number;
  returningCustomers: number;
  retention: number;
  perDay: number;
  byStatus: HistogramRow[];
  byDay: HistogramRow[];
  byService: HistogramRow[];
  byBarber: HistogramRow[];
  byBranch: HistogramRow[];
};

export type AnalyticsData = {
  range: AnalyticsRange;
  stats: AnalyticsStats;
  popular: HistogramRow[];
  team: Array<{ id: string; name: string }>;
};

export type AnalyticsParams = {
  business?: string;
  barber?: string;
  branch?: string;
  range?: AnalyticsKey;
  service?: string;
};

export type ReplyInput = { id: string; reply: string };

/* ------------------------------------------------------------------- keys */

export const teamKeys = {
  team: (business?: string) => ["team", business ?? ""] as const,
  branches: (business?: string) => ["branches", business ?? ""] as const,
  invites: ["invites"] as const,
  analytics: (params: AnalyticsParams) =>
    [
      "analytics",
      params.business ?? "",
      params.barber ?? "",
      params.branch ?? "",
      params.range ?? "",
      params.service ?? "",
    ] as const,
  reviews: (barber?: string) => keys.reviews(barber ?? ""),
};

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** A successful team or branch change affects every workspace view. */
function refresh(client: QueryClient) {
  for (const prefix of [
    "team",
    "branches",
    "invites",
    "analytics",
    "reviews",
    "barber",
    "barbers",
  ]) {
    void client.invalidateQueries({ queryKey: [prefix] });
  }
  void client.invalidateQueries({ queryKey: keys.me });
}

/* ------------------------------------------------------------------ reads */

export function useTeam(business?: string) {
  return useQuery({
    queryKey: teamKeys.team(business),
    queryFn: () => api<TeamData>(`/api/barber/team${query({ business })}`),
    enabled: Boolean(business),
  });
}

export function useBranches(business?: string) {
  return useQuery({
    queryKey: teamKeys.branches(business),
    queryFn: () =>
      api<{ branches: Branch[] }>(`/api/barber/branches${query({ business })}`).then(
        (r) => r.branches,
      ),
    enabled: Boolean(business),
  });
}

export function useMyInvitations() {
  return useQuery({
    queryKey: teamKeys.invites,
    queryFn: () => api<{ invites: Invite[] }>("/api/invites").then((r) => r.invites),
  });
}

export function useAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: teamKeys.analytics(params),
    queryFn: () =>
      api<AnalyticsData>(
        `/api/barber/analytics${query({
          business: params.business,
          barber: params.barber,
          branch: params.branch,
          range: params.range,
          service: params.service,
        })}`,
      ),
    enabled: Boolean(params.business || params.barber),
  });
}

export function useReviewsForBarber(barber?: string) {
  return useQuery({
    queryKey: teamKeys.reviews(barber),
    queryFn: () =>
      api<{ reviews: Review[] }>(`/api/reviews?barber=${encodeURIComponent(barber ?? "")}`).then(
        (r) => r.reviews,
      ),
    enabled: Boolean(barber),
  });
}

/* ----------------------------------------------------------------- writes */

export function useInviteMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteInput) =>
      api<{ invite: Invite }>("/api/barber/team", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.invite),
    onSuccess: () => refresh(client),
  });
}

export function useUpdateMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberPatch) =>
      api<{ member: Membership }>("/api/barber/team", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.member),
    onSuccess: () => refresh(client),
  });
}

export function useRemoveMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamDeleteInput) =>
      api<{ ok: true }>(
        `/api/barber/team${query({
          member: input.member,
          business: input.business,
        })}`,
        { method: "DELETE" },
      ),
    onSuccess: () => refresh(client),
  });
}

export function useRevokeInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamDeleteInput) =>
      api<{ ok: true }>(
        `/api/barber/team${query({
          invite: input.invite,
          business: input.business,
        })}`,
        { method: "DELETE" },
      ),
    onSuccess: () => refresh(client),
  });
}

export function useCreateBranch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchCreate) =>
      api<{ branch: Branch }>("/api/barber/branches", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.branch),
    onSuccess: () => refresh(client),
  });
}

export function useUpdateBranch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchPatch) =>
      api<{ branch: Branch }>("/api/barber/branches", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.branch),
    onSuccess: () => refresh(client),
  });
}

export function useCloseBranch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchDelete) =>
      api<{ ok: true }>(
        `/api/barber/branches${query({ id: input.id, business: input.business })}`,
        { method: "DELETE" },
      ),
    onSuccess: () => refresh(client),
  });
}

export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ member: Membership }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ token }),
      }).then((r) => r.member),
    onSuccess: () => refresh(client),
  });
}

export function useDeclineInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/invites?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client),
  });
}

/** A professional's answer to a review; invalidates both review views. */
export function useReplyReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReplyInput) =>
      api<{ review: Review }>("/api/barber/reviews", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.review),
    onSuccess: () => refresh(client),
  });
}
