import { create } from "zustand";

export type Locale = "uz" | "ru" | "en";

type LocaleStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const KEY = "icone_locale";

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: "uz",
  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      localStorage.setItem(KEY, locale);
      document.cookie = `${KEY}=${locale};path=/;max-age=31536000;samesite=lax`;
    }
    set({ locale });
  },
}));

export function readStoredLocale(): Locale {
  if (typeof document === "undefined") return "uz";
  const match = document.cookie.match(/(?:^|;\s*)icone_locale=(uz|ru|en)/);
  const value = match?.[1] ?? localStorage.getItem(KEY);
  return value === "ru" || value === "en" ? value : "uz";
}
