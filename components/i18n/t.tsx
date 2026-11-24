"use client";

import { useT } from "@/lib/i18n/use-t";

/** Translate a static string inside server or client components. */
export function T({ k }: { k: string }) {
  return <>{useT()(k)}</>;
}
