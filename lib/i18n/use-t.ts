"use client";

import { useCallback } from "react";

import { translate } from "@/lib/i18n/dictionaries";
import { useLocaleStore } from "@/lib/store/locale";

export function useT() {
  const locale = useLocaleStore((state) => state.locale);
  return useCallback((key: string) => translate(locale, key), [locale]);
}
