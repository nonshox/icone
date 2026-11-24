"use client";

import { useSyncExternalStore } from "react";

import { today } from "@/lib/domain/time";

const subscribe = () => () => {};
const getSnapshot = () => today();
// During prerender there is no reliable local shop date — render nothing and
// let the first client render fill it in. Avoids hydration mismatches.
const getServerSnapshot = () => "";

/** Today's date in Tashkent, safe to use while prerendering. */
export function useShopDate(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
