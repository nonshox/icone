import type { Locale } from "@/lib/store/locale";

import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { uz } from "./locales/uz";

export type Dictionary = Record<string, string>;

/**
 * All locales, for server-side use (static metadata, tooling and parity checks).
 * Client code imports `@/lib/i18n/translate` instead: it bundles only the
 * default Uzbek locale and fetches the others as separate chunks on demand.
 */
export const dictionaries: Record<Locale, Dictionary> = { uz, ru, en };
