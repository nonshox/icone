"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { isDate } from "@/lib/domain/time";
import { useBookingDraft } from "@/lib/store/booking-draft";

/**
 * Copy a booking link into the draft:
 * `?barber=&services=<id>&services=<id>&date=&start=`.
 * The older single `service=` form still works.
 */
export function DraftSync() {
  const params = useSearchParams();
  const barber = params.get("barber");
  const services = [
    ...params.getAll("services").flatMap((value) => value.split(",")),
    ...params.getAll("service"),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const serviceKey = services.join(",");
  const rawDate = params.get("date");
  const date = rawDate && isDate(rawDate) ? rawDate : null;
  const rawStart = params.get("start");
  const parsedStart = rawStart === null ? null : Number(rawStart);
  const start =
    parsedStart !== null &&
    Number.isInteger(parsedStart) &&
    parsedStart >= 0 &&
    parsedStart < 1440
      ? parsedStart
      : null;

  useEffect(() => {
    if (!barber && !serviceKey && !date && start === null) return;

    const state = useBookingDraft.getState();
    state.reset();
    if (barber) state.setBarber(barber);
    if (serviceKey) state.setServices(serviceKey.split(","));
    if (date) state.setDate(date);
    if (start !== null) state.setStart(start);
  }, [barber, serviceKey, date, start]);

  return null;
}
