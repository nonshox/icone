"use client";

import { ArrowRight, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { T } from "@/components/i18n/t";
import { SearchResults } from "@/components/search/search-results";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * Landing hero search. All copy is landing-specific; the query, result rows
 * and destination URLs come from the one shared discovery component.
 */
export function LandingSearch() {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(draft.trim());
  }

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

      {submitted ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <T k="landing.searchResults" />
          </p>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-2">
            <SearchResults
              query={submitted}
              limit={6}
              hideHint
              emptyKey="landing.searchEmpty"
              errorKey="landing.searchError"
              allKey="landing.searchAll"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
