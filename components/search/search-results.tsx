"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { T } from "@/components/i18n/t";
import { ErrorState, LoadingRows } from "@/components/ui/app-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { imageUrl } from "@/lib/client/files";
import { useT } from "@/lib/i18n/use-t";
import { formatPrice } from "@/lib/domain/time";

/** The fields the compact result rows use. The API returns a superset. */
export type SearchHit = {
  kind: "barber" | "shop";
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  city: string;
  district: string;
  rating: number;
  price: number;
  photo: string;
  verified: boolean;
};

/** The one canonical profile link used by every discovery surface. */
export function profileHref(slug: string): string {
  return `/b/${encodeURIComponent(slug || "")}`;
}

/** The one canonical "all results" link used by every discovery surface. */
export function allResultsHref(query: string): string {
  const text = query.trim();
  return text ? `/map?q=${encodeURIComponent(text)}` : "/map";
}

export function SearchResults({
  query,
  limit = 8,
  minChars = 2,
  compact = false,
  hideHint = false,
  hideFooter = false,
  onNavigate,
  emptyKey = "search.empty",
  errorKey = "search.error",
  allKey = "search.all",
  showSpecialtyFilter = false,
  className,
}: {
  query: string;
  limit?: number;
  minChars?: number;
  /** Tighter rows for the header dialog; section rows show price and district. */
  compact?: boolean;
  hideHint?: boolean;
  hideFooter?: boolean;
  onNavigate?: () => void;
  emptyKey?: string;
  errorKey?: string;
  allKey?: string;
  /** Directory mode: keep the specialty dropdown the `/barbers` page had. */
  showSpecialtyFilter?: boolean;
  className?: string;
}) {
  const t = useT();
  const [specialty, setSpecialty] = useState("all");
  const text = query.trim();
  const enabled = text.length >= minChars;

  const results = useQuery({
    queryKey: ["search-results", text, limit],
    queryFn: () =>
      api<{ results: SearchHit[] }>(
        `/api/search?q=${encodeURIComponent(text)}&limit=${limit}`,
      ).then((response) => response.results),
    enabled,
    staleTime: 60_000,
  });

  const hits = useMemo(() => results.data ?? [], [results.data]);
  const specialties = useMemo(
    () =>
      showSpecialtyFilter
        ? [...new Set(hits.map((hit) => hit.subtitle).filter(Boolean))].sort()
        : [],
    [hits, showSpecialtyFilter],
  );
  const visible = useMemo(
    () =>
      specialty === "all"
        ? hits
        : hits.filter((hit) => hit.subtitle === specialty),
    [hits, specialty],
  );

  return (
    <div className={className}>
      {showSpecialtyFilter ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_200px]">
          <p className="self-end text-xs text-muted-foreground">
            <T k="barbers.subtitle" />
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="search-specialty"><T k="barbers.speciality" /></Label>
            <Select
              value={specialty}
              onValueChange={(value) => setSpecialty(String(value))}
            >
              <SelectTrigger id="search-specialty" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("barbers.all")}</SelectItem>
                {specialties.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div aria-live="polite">
        {!enabled ? (
          hideHint ? null : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              <T k="search.hint" />
            </p>
          )
        ) : results.isPending ? (
          compact ? (
            <p className="flex items-center justify-center gap-2 px-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <T k="search.loading" />
            </p>
          ) : (
            <LoadingRows count={3} rowClassName="h-16 w-full rounded-2xl" />
          )
        ) : results.isError ? (
          <ErrorState
            fallback={t(errorKey)}
            onRetry={() => void results.refetch()}
          />
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
            <T
              k={
                showSpecialtyFilter && specialty !== "all"
                  ? "barbers.noMatch"
                  : emptyKey
              }
            />
          </p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label={t("search.title")}>
            {visible.map((hit) => {
              const photo = imageUrl(hit.photo);
              return (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={profileHref(hit.slug || hit.id)}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-foreground/[0.05]"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-medium text-muted-foreground"
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="size-full object-cover" />
                      ) : (
                        hit.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{hit.name}</span>
                        {hit.verified ? (
                          <span
                            role="img"
                            className="size-1.5 shrink-0 rounded-full bg-brand-strong"
                            aria-label={t("shop.verified")}
                          />
                        ) : null}
                      </span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        {compact
                          ? [hit.kind === "shop" ? t("shop.title") : t("nav.barbers"), hit.city]
                              .filter(Boolean)
                              .join(" · ")
                          : [hit.subtitle, hit.district, hit.city].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {!compact && hit.price > 0 ? (
                      <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                        {formatPrice(hit.price)}
                      </span>
                    ) : null}
                    {hit.rating > 0 ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                        <Star className="size-3 fill-brand text-brand" aria-hidden />
                        {hit.rating.toFixed(1)}
                      </span>
                    ) : null}
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hideFooter ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
          <Link
            href={allResultsHref(text)}
            onClick={onNavigate}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-strong hover:bg-brand/10"
          >
            <T k={allKey} />
          </Link>
          <Link
            href="/map"
            onClick={onNavigate}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <MapPin className="size-3.5" aria-hidden />
            <T k="search.map" />
          </Link>
        </div>
      )}
    </div>
  );
}
