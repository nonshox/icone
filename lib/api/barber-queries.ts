"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type {
  Barber,
  BookingRow,
  Client,
  Notification,
  NotificationPrefs,
  PortfolioItem,
  Service,
} from "@/lib/domain/types";

import { api, ApiError } from "./client";

export type {
  Barber,
  BookingRow,
  Client,
  Notification,
  NotificationPrefs,
  PortfolioItem,
  Service,
};

/** The dashboard only reports real counts — no invented revenue. */
export type DashboardData = {
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
  clients: number;
  returning: number;
  rating: number;
  views: number;
};

export type Customer = Client & { visits: number; last: string; name: string };
export type CustomerDetail = Customer & {
  visits: number;
  completed: number;
  last: string;
  services: string[];
  note: string;
  noteId: string;
  bookings: BookingRow[];
};
export type NotificationRow = Notification;
export type PortfolioInput = {
  url: string;
  note?: string;
  group?: string;
  featured?: boolean;
  public?: boolean;
};
export type ServiceInput = {
  name: string;
  note?: string;
  price: number;
  time: number;
  buffer?: number;
  category?: string;
  active?: boolean;
  /** Appwrite file id (or a legacy external URL). */
  image?: string;
};
export type UploadFolder =
  | "avatar"
  | "logo"
  | "cover"
  | "portfolio"
  | "service";
export type UploadedFile = { id: string; url: string };
export type ServicePatch = Partial<ServiceInput> & { id: string };
export type PortfolioPatch = Partial<PortfolioInput> & { id: string };
export type SettingsPatch = {
  /** `logo` applies to a business workspace; `photo` to a professional. */
  profile?: Partial<Barber> & { logo?: string };
  prefs?: Partial<NotificationPrefs>;
};

export const barberKeys = {
  dashboard: ["barber", "dashboard"] as const,
  services: ["barber", "services"] as const,
  customers: ["barber", "customers"] as const,
  customer: (id: string) => ["barber", "customers", id] as const,
  portfolio: ["barber", "portfolio"] as const,
  notifications: ["barber", "notifications"] as const,
  settings: ["barber", "settings"] as const,
};

function refresh(client: QueryClient, catalogue = false) {
  void client.invalidateQueries({ queryKey: ["barber"] });
  if (catalogue) {
    void client.invalidateQueries({ queryKey: ["barbers"] });
    void client.invalidateQueries({ queryKey: ["services"] });
  }
}

/* ------------------------------------------------------------------ reads */

export function useBarberDashboard() {
  return useQuery({
    queryKey: barberKeys.dashboard,
    queryFn: () =>
      api<{ dashboard: DashboardData }>("/api/barber/dashboard").then(
        (r) => r.dashboard,
      ),
    refetchInterval: 60_000,
  });
}

export function useBarberServices() {
  return useQuery({
    queryKey: barberKeys.services,
    queryFn: () =>
      api<{ services: Service[] }>("/api/barber/services").then((r) => r.services),
  });
}

export function useBarberCustomers() {
  return useQuery({
    queryKey: barberKeys.customers,
    queryFn: () =>
      api<{ customers: Customer[] }>("/api/barber/customers").then(
        (r) => r.customers,
      ),
  });
}

export function useBarberCustomer(id: string) {
  return useQuery({
    queryKey: barberKeys.customer(id),
    queryFn: () =>
      api<{ customer: CustomerDetail }>(
        `/api/barber/customers?id=${encodeURIComponent(id)}`,
      ).then((r) => r.customer),
    enabled: Boolean(id),
  });
}

export function useBarberPortfolio() {
  return useQuery({
    queryKey: barberKeys.portfolio,
    queryFn: () =>
      api<{ items: PortfolioItem[] }>("/api/barber/portfolio").then(
        (r) => r.items,
      ),
  });
}

export function useBarberNotifications() {
  return useQuery({
    queryKey: barberKeys.notifications,
    queryFn: () =>
      api<{ notifications: NotificationRow[] }>("/api/barber/notifications").then(
        (r) => r.notifications,
      ),
    refetchInterval: 60_000,
  });
}

export function useBarberSettings(scope: "barber" | "business" | "" = "") {
  return useQuery({
    queryKey: [...barberKeys.settings, scope],
    queryFn: () =>
      api<{ barber: Barber; prefs: NotificationPrefs; scope?: string }>(
        `/api/barber/settings${scope ? `?scope=${scope}` : ""}`,
      ),
  });
}

/* ----------------------------------------------------------------- writes */

export function useCreateBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      api<{ service: Service }>("/api/barber/services", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.service),
    onSuccess: () => refresh(client, true),
  });
}

export function useUpdateBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ServicePatch) =>
      api<{ service: Service }>("/api/barber/services", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.service),
    onSuccess: () => refresh(client, true),
  });
}

export function useDeleteBarberService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/barber/services?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, true),
  });
}

export function useSaveBarberNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { client: string; note: string }) =>
      api<{ client: Client }>("/api/barber/customers", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.client),
    onSuccess: () => refresh(client),
  });
}

export function useCreateBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioInput) =>
      api<{ item: PortfolioItem }>("/api/barber/portfolio", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.item),
    onSuccess: () => refresh(client, true),
  });
}

export function useUpdateBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioPatch) =>
      api<{ item: PortfolioItem }>("/api/barber/portfolio", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.item),
    onSuccess: () => refresh(client, true),
  });
}

export function useDeleteBarberPortfolio() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/barber/portfolio?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => refresh(client, true),
  });
}

export function useMarkBarberNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ notification: NotificationRow }>("/api/barber/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      }).then((r) => r.notification),
    onSuccess: () => refresh(client),
  });
}

export function useMarkAllBarberNotifications() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ changed: number }>("/api/barber/notifications", {
        method: "PATCH",
        body: JSON.stringify({ all: true }),
      }).then((r) => r.changed),
    onSuccess: () => refresh(client),
  });
}

export function useUpdateBarberSettings(scope: "barber" | "business" | "" = "") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsPatch) =>
      api<{ barber: Barber; prefs: NotificationPrefs }>(
        `/api/barber/settings${scope ? `?scope=${scope}` : ""}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => refresh(client, true),
  });
}

/* ---------------------------------------------------------------- uploads */

type UploadVariables = {
  file: File;
  folder: UploadFolder;
  onProgress?: (percent: number) => void;
};

type UploadResponse = {
  ok?: boolean;
  id?: string;
  url?: string;
  error?: { message?: string; code?: string };
};

/**
 * Multipart upload to Appwrite Storage. We use XHR (not the JSON `api` helper)
 * so the browser keeps the multipart boundary and reports real progress.
 * Cookies are sent automatically for this same-origin request.
 */
function sendImage({
  file,
  folder,
  onProgress,
}: UploadVariables): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data: UploadResponse | null = null;
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        // Leave the generic message below.
      }
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        data?.ok &&
        typeof data.id === "string"
      ) {
        resolve({ id: data.id, url: typeof data.url === "string" ? data.url : "" });
        return;
      }
      reject(
        new ApiError(
          data?.error?.message ?? "Upload failed.",
          data?.error?.code ?? "upload_failed",
          xhr.status,
        ),
      );
    };
    xhr.onerror = () =>
      reject(new ApiError("Upload failed.", "upload_failed", 0));
    xhr.send(body);
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (input: UploadVariables) => sendImage(input),
  });
}
