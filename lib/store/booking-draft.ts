import { create } from "zustand";

/**
 * The booking form draft. Client-only: the server owns availability and
 * prices, so nothing stored here is trusted or sent as a price.
 *
 * A visit may contain several services. `services` is the source of truth;
 * `setService` keeps the old single-service callers (deep links, rebooking)
 * working by replacing the whole selection.
 *
 * `date` starts empty on purpose — the page fills it on mount, so a
 * prerendered shell never bakes in the build day.
 *
 * Setting a business or branch selects "any professional" by default; an
 * explicit `setBarber` call clears that default and keeps the deep link exact.
 */
type BookingDraft = {
  services: string[];
  barber: string;
  /** Shop context: lets the server pick the first qualified employee. */
  business: string;
  branch: string;
  anyBarber: boolean;
  date: string;
  start: number | null;
  note: string;
  setServices: (services: string[]) => void;
  toggleService: (service: string) => void;
  /** Legacy single-service setter, kept for links and rebooking. */
  setService: (service: string) => void;
  setBarber: (barber: string) => void;
  setBusiness: (business: string) => void;
  setBranch: (branch: string) => void;
  setAnyBarber: (any: boolean) => void;
  setDate: (date: string) => void;
  setStart: (start: number | null) => void;
  setNote: (note: string) => void;
  /** Seed a fresh draft from an existing visit (rebook). */
  seed: (input: { barber: string; services: string[] }) => void;
  reset: () => void;
};

const initial = {
  services: [] as string[],
  barber: "",
  business: "",
  branch: "",
  anyBarber: false,
  date: "",
  start: null,
  note: "",
};

/** Drop duplicates and empty ids without changing the performed order. */
function clean(services: string[]): string[] {
  return [...new Set(services.map((id) => String(id).trim()).filter(Boolean))].slice(0, 10);
}

export const useBookingDraft = create<BookingDraft>((set) => ({
  ...initial,
  setServices: (services) => set({ services: clean(services), start: null }),
  toggleService: (service) =>
    set((state) => {
      const id = String(service).trim();
      if (!id) return state;
      const selected = state.services.includes(id)
        ? state.services.filter((item) => item !== id)
        : clean([...state.services, id]);
      return { services: selected, start: null };
    }),
  setService: (service) => set({ services: clean(service ? [service] : []), start: null }),
  setBarber: (barber) =>
    set({ barber, anyBarber: barber === "any", start: null }),
  // A shop context means "any qualified employee" until a person is chosen.
  // An explicit barber always wins, including on deep links and rebooking.
  setBusiness: (business) =>
    set((state) => ({
      business,
      anyBarber: business && !state.barber ? true : state.anyBarber,
      start: null,
    })),
  setBranch: (branch) =>
    set((state) => ({
      branch,
      anyBarber: branch && !state.barber ? true : state.anyBarber,
      start: null,
    })),
  setAnyBarber: (anyBarber) => set({ anyBarber, barber: "", start: null }),
  setDate: (date) => set({ date, start: null }),
  setStart: (start) => set({ start }),
  setNote: (note) => set({ note }),
  seed: ({ barber, services }) =>
    set({ ...initial, barber, services: clean(services) }),
  reset: () => set(initial),
}));
