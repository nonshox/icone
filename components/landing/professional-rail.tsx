"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";

import { T } from "@/components/i18n/t";
import { profileHref } from "@/components/search/search-results";
import { useT } from "@/lib/i18n/use-t";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/ui/app-state";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useShopDate } from "@/lib/client/date";
import { imageUrl } from "@/lib/client/files";
import type { SearchResult } from "@/lib/domain/discovery";
import { formatPrice, label } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

type RailProps = {
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  /** Query against the live discovery endpoint. */
  endpoint: string;
  moreHref: string;
  /** "Available today" results must match Tashkent's current date. */
  todayOnly?: boolean;
};

export function ProfessionalRail({
  eyebrowKey,
  titleKey,
  bodyKey,
  endpoint,
  moreHref,
  todayOnly = false,
}: RailProps) {
  const t = useT();
  const today = useShopDate();
  const query = useQuery({
    queryKey: ["landing-rail", endpoint],
    queryFn: () => api<{ results: SearchResult[] }>(endpoint),
    staleTime: 60_000,
  });

  const all = query.data?.results ?? [];
  const rows = (todayOnly && today ? all.filter((row) => row.next?.date === today) : all).slice(0, 4);

  return (
    <section className="mt-14 sm:mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k={eyebrowKey} />
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            <T k={titleKey} />
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            <T k={bodyKey} />
          </p>
        </div>
        <Link
          href={moreHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
        >
          <T k="landing.explore" />
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div aria-live="polite" className="mt-6">
        {query.isLoading ? (
          <LoadingRows
            count={4}
            className="grid gap-3 space-y-0 sm:grid-cols-2 lg:grid-cols-4"
            rowClassName="h-40 w-full rounded-2xl"
          />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            fallback={t("landing.cardsError")}
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState><T k="landing.cardsEmpty" /></EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <Link
                key={`${row.kind}-${row.id}`}
                href={profileHref(row.slug || row.id)}
                className="group flex min-h-40 flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-brand/60 hover:bg-brand/5"
              >
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden
                    style={photoStyle(row.photo)}
                    className="size-11 shrink-0 rounded-xl bg-muted bg-cover bg-center"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {row.rating > 0 ? (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Star className="size-3 fill-current text-brand-strong" aria-hidden />
                      {row.rating.toFixed(1)}
                    </span>
                  ) : null}
                  <span>{t("landing.reviewCount").replace("{n}", String(row.reviews))}</span>
                  {row.city ? <span className="truncate">{row.city}</span> : null}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  {row.price > 0 ? (
                    <span className="text-muted-foreground">
                      {t("landing.from")} {formatPrice(row.price)}
                    </span>
                  ) : null}
                  {row.next ? (
                    <span className="font-medium text-brand-strong">
                      {t("landing.nextSlot").replace("{time}", label(row.next.start))}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
