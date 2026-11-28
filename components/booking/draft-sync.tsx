"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { isDate } from "@/lib/domain/time";
import { useBookingDraft } from "@/lib/store/booking-draft";

/**
 * Copy a booking link into the draft. The canonical form is
 * `/book?business=&branch=&any=1&services=<id>&services=<id>&date=&start=`.
 * The older `barber=`/`service=` links keep working, and a barber deep link
 * always wins over the shop's "any professional" default. `note=` is optional
 * and only exists so the sign-in round trip can restore the whole draft.
 */
export function DraftSync() {
  const params = useSearchParams();
  const barber = params.get("barber");
  const business = params.get("business") ?? "";
  const branch = params.get("branch") ?? "";
  const explicitBarber = Boolean(barber && barber !== "any");
  // A shop (or branch) link means "any professional" unless a person was
  // named explicitly. `any=1` is still honoured on its own.
  const anyBarber =
    params.get("any") === "1" ||
    barber === "any" ||
    (!explicitBarber && Boolean(business || branch));
  const services = [
    ...params.getAll("services").flatMap((value) => value.split(",")),
    ...params.getAll("service"),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const serviceKey = services.join(",");
  const note = params.get("note") ?? "";
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
    if (!barber && !business && !branch && !serviceKey && !note && !date && start === null) return;

    const state = useBookingDraft.getState();
    state.reset();
    if (business) state.setBusiness(business);
    if (branch) state.setBranch(branch);
    if (barber && barber !== "any") state.setBarber(barber);
    if (anyBarber) state.setAnyBarber(true);
    if (serviceKey) state.setServices(serviceKey.split(","));
    if (date) state.setDate(date);
    if (start !== null) state.setStart(start);
    if (note) state.setNote(note.slice(0, 200));
  }, [barber, branch, business, anyBarber, explicitBarber, serviceKey, note, date, start]);

  return null;
}
