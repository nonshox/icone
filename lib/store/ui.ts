import { create } from "zustand";

type UIStore = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

/**
 * Client-only UI state. Server data (user, bookings) never belongs here —
 * it comes from server components and route handlers.
 */
export const useUIStore = create<UIStore>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
