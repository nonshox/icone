"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { isDate } from "@/lib/domain/time";
import { useBookingDraft } from "@/lib/store/booking";

/** Copy a booking link (`?barber=&service=&date=&start=`) into the draft. */
export function DraftSync() {
  const params = useSearchParams();
  const barber = params.get("barber");
  const service = params.get("service");
  const rawDate = params.get("date");
  const date = rawDate && isDate(rawDate) ? rawDate : null;
  const rawStart = params.get("start");
  const parsedStart = rawStart === null ? null : Number(rawStart);
  const start =
    parsedStart !== null && Number.isInteger(parsedStart) && parsedStart >= 0 && parsedStart < 1440
      ? parsedStart
      : null;

  useEffect(() => {
    if (!barber && !service && !date && start === null) return;

    const state = useBookingDraft.getState();
    state.reset();
    if (barber) state.setBarber(barber);
    if (service) state.setService(service);
    if (date) state.setDate(date);
    if (start !== null) state.setStart(start);
  }, [barber, service, date, start]);

  return null;
}
