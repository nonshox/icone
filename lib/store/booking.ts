import { create } from "zustand";

type BookingDraft = {
  service: string;
  barber: string;
  date: string;
  start: number | null;
  note: string;
  setService: (service: string) => void;
  setBarber: (barber: string) => void;
  setDate: (date: string) => void;
  setStart: (start: number | null) => void;
  setNote: (note: string) => void;
  reset: () => void;
};

/**
 * The booking form draft. Client-only: the server owns availability and
 * bookings, so nothing here is trusted.
 *
 * `date` starts empty on purpose — the page fills it on mount, so a
 * prerendered shell never bakes in the build day.
 */
const initial = {
  service: "",
  barber: "",
  date: "",
  start: null,
  note: "",
};

export const useBookingDraft = create<BookingDraft>((set) => ({
  ...initial,
  setService: (service) => set({ service, start: null }),
  setBarber: (barber) => set({ barber, start: null }),
  setDate: (date) => set({ date, start: null }),
  setStart: (start) => set({ start }),
  setNote: (note) => set({ note }),
  reset: () => set(initial),
}));
