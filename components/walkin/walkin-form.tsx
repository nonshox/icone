"use client";

import { AppointmentEditor } from "@/components/agenda/appointment-editor";

/**
 * `/agenda/walkin` keeps working, but there is no second form: the page is a
 * thin entry point into the same editor the calendar uses.
 */
export function WalkinForm() {
  return <AppointmentEditor />;
}
