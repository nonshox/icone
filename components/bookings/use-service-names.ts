"use client";

import { useCallback, useMemo } from "react";

import { useServices } from "@/lib/api/queries";
import type { BookingRow } from "@/lib/domain/types";

/**
 * Visit rows carry service ids; names live in the catalogue. Resolve them on
 * the client for display only — the server remains the pricing authority.
 */
export function useServiceNames() {
  const services = useServices();
  const byId = useMemo(
    () => new Map((services.data ?? []).map((item) => [item.id, item.name])),
    [services.data],
  );

  return useCallback(
    (booking: Pick<BookingRow, "items" | "service" | "serviceName">): string => {
      const ids = booking.items.length > 0 ? booking.items : [booking.service];
      const names = ids
        .map((id) => byId.get(id))
        .filter((name): name is string => Boolean(name));
      return names.length > 0 ? names.join(" + ") : booking.serviceName;
    },
    [byId],
  );
}
