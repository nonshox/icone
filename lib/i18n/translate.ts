import type { Locale } from "@/lib/store/locale";

import { uz } from "./locales/uz";

type Dictionary = Record<string, string>;

/**
 * Only the default locale is bundled into the browser. Russian and English are
 * separate chunks, fetched the first time a visitor selects them. `translate`
 * stays synchronous so `<T>` and `useT()` keep their existing API.
 */
const loaded: Partial<Record<Locale, Dictionary>> = { uz };

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  uz: async () => uz,
  ru: () => import("./locales/ru").then((module) => module.ru),
  en: () => import("./locales/en").then((module) => module.en),
};

/** Ensure a locale is in the runtime map. Returns true when a chunk was loaded. */
export async function loadLocale(locale: Locale): Promise<boolean> {
  if (loaded[locale]) return false;
  loaded[locale] = await loaders[locale]();
  return true;
}

export function translate(locale: Locale, key: string): string {
  const fallback = loaded.uz ?? {};
  const dictionary = loaded[locale] ?? fallback;
  const value = dictionary[key] ?? fallback[key];

  if (value === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing dictionary key "${key}" for locale "${locale}".`);
    }
    return key;
  }

  return value;
}
