"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useBookingDraft } from "@/lib/store/booking";

/** Copy `?barber=` / `?service=` from a link into the local draft. */
export function DraftSync() {
  const params = useSearchParams();
  const barber = params.get("barber");
  const service = params.get("service");

  useEffect(() => {
    const state = useBookingDraft.getState();
    if (barber && state.barber !== barber) state.setBarber(barber);
    if (service && state.service !== service) state.setService(service);
  }, [barber, service]);

  return null;
}
