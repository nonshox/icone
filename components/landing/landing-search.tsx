"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Search, Star } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { imageUrl } from "@/lib/client/files";
import type { SearchResult } from "@/lib/domain/discovery";
import { formatPrice } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

function profileHref(row: SearchResult) {
  const slug = row.slug || row.id;
  return row.kind === "shop" ? `/shop/${slug}` : `/barbers/${slug}`;
}

/** Live search on the landing page: name, service or district. */
export function LandingSearch() {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");

  const query = useQuery({
    queryKey: ["landing-search", submitted],
    queryFn: () =>
      api<{ results: SearchResult[] }>(
        `/api/search?q=${encodeURIComponent(submitted)}&limit=6`,
      ),
    enabled: submitted.length > 0,
    staleTime: 60_000,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(draft.trim());
  }

  const results = query.data?.results ?? [];
  const allHref = submitted
    ? `/barbers?q=${encodeURIComponent(submitted)}`
    : "/barbers";

  return (
    <section className="rounded-3xl border border-border/70 bg-card/60 p-5 sm:p-7">
      <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
        <T k="landing.searchEyebrow" />
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
        <T k="landing.searchTitle" />
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        <T k="landing.searchBody" />
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="landing-search" className="sr-only">
            <T k="common.search" />
          </label>
          <Input
            id="landing-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("landing.searchPlaceholder")}
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-6 text-sm disabled:opacity-50")}
        >
          <T k="landing.searchButton" />
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        <T k="landing.searchHint" />
      </p>

      <div aria-live="polite" className="mt-5">
        {!submitted ? null : query.isLoading ? (
          <ul className="space-y-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <li key={index}>
                <Skeleton className="h-16 w-full rounded-2xl" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive"><T k="landing.searchError" /></p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-2 text-sm font-medium text-foreground underline underline-offset-4"
            >
              <T k="common.tryAgain" />
            </button>
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
            <T k="landing.searchEmpty" />
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              <T k="landing.searchResults" />
            </p>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
              {results.map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <Link
                    href={profileHref(row)}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-brand/5"
                  >
                    <div
                      aria-hidden
                      style={photoStyle(row.photo)}
                      className="size-10 shrink-0 rounded-xl bg-muted bg-cover bg-center"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        {[row.subtitle, row.district, row.city].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">
                      {row.rating > 0 ? (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Star className="size-3 fill-current text-brand-strong" aria-hidden />
                          {row.rating.toFixed(1)}
                        </span>
                      ) : null}
                      {row.price > 0 ? <span>{formatPrice(row.price)}</span> : null}
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href={allHref} className="font-medium text-brand-strong underline-offset-4 hover:underline">
          <T k="landing.searchAll" />
        </Link>
        <Link href="/map" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          <T k="landing.mapCta" />
        </Link>
      </div>
    </section>
  );
}
