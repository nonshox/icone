"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";

import { allResultsHref, SearchResults } from "./search-results";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const LIMIT = 8;

/** Portal mount guard: false during SSR/hydration, true on the client. */
const subscribe = () => () => {};
const isClient = () => true;
const isServer = () => false;

/**
 * Header search. A single icon opens a dialog on every viewport, so the mobile
 * bar keeps its five tabs and the desktop bar stays uncluttered. The query and
 * result rows are the same ones the landing page and `/barbers` use.
 */
export function GlobalSearch() {
  const t = useT();
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("search.open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <Search className="size-[1.15rem]" aria-hidden />
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[max(4.5rem,env(safe-area-inset-top))] sm:pt-20">
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={close}
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="global-search-title"
                className="relative flex max-h-[min(75dvh,34rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-lg"
              >
                <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
                  <label htmlFor="global-search-input" className="sr-only">
                    {t("search.title")}
                  </label>
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <input
                    id="global-search-input"
                    ref={inputRef}
                    type="search"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={t("search.placeholder")}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    aria-label={t("common.close")}
                    onClick={close}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {text.trim().length < MIN_CHARS ? (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                      <T k="search.hint" />
                    </p>
                  ) : (
                    <SearchResults
                      query={debounced}
                      limit={LIMIT}
                      minChars={MIN_CHARS}
                      compact
                      hideFooter
                      onNavigate={close}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
                  <Link
                    href={allResultsHref(text)}
                    onClick={close}
                    className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-strong hover:bg-brand/10"
                  >
                    <T k="search.all" />
                  </Link>
                  <Link
                    href="/map"
                    onClick={close}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  >
                    <T k="search.map" />
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
