"use client";

import { useCallback, useEffect, useReducer } from "react";

import { loadLocale, translate } from "@/lib/i18n/translate";
import { useLocaleStore } from "@/lib/store/locale";

export function useT() {
  const locale = useLocaleStore((state) => state.locale);
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    let active = true;
    void loadLocale(locale).then((loadedNow) => {
      // The dictionary map is mutable; re-render once a new chunk has arrived.
      if (active && loadedNow) refresh();
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return useCallback((key: string) => translate(locale, key), [locale]);
}
