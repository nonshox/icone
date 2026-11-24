"use client";

import { useEffect } from "react";

import { readStoredLocale, useLocaleStore } from "@/lib/store/locale";

/** Applies the saved language after hydration — no SSR mismatch. */
export function LocaleInitializer() {
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    setLocale(readStoredLocale());
  }, [setLocale]);

  return null;
}
