import type { Metadata } from "next";

import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * Static metadata is resolved at build time and cannot read the visitor's
 * stored locale. Uzbek is the canonical default here; the page body switches
 * language at runtime through <T>/useT(). Do not add a client-only metadata
 * hack — crawlers and share previews only ever see this static output.
 */
const DEFAULT_LOCALE = "uz" as const;

function text(key: string): string {
  return dictionaries[DEFAULT_LOCALE][key] ?? key;
}

/** Dictionary lookup for the two routes whose metadata depends on a record. */
export function metaText(key: string): string {
  return text(key);
}

export type RouteMetadataInput = {
  /** Canonical route path, resolved against the root metadataBase. */
  path: string;
  titleKey: string;
  descriptionKey: string;
  /** Private workspaces stay out of the index. */
  private?: boolean;
  /** Home keeps its absolute brand title. */
  absolute?: boolean;
};

/** Build per-route metadata from dictionary keys (Uzbek static defaults). */
export function routeMetadata({
  path,
  titleKey,
  descriptionKey,
  private: isPrivate = false,
  absolute = false,
}: RouteMetadataInput): Metadata {
  const title = text(titleKey);
  const description = text(descriptionKey);

  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
    ...(isPrivate
      ? {}
      : {
          openGraph: {
            type: "website" as const,
            locale: text("meta.site.ogLocale"),
            siteName: "icone",
            title,
            description,
            url: path,
          },
        }),
  };
}
