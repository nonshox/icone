"use client";

import { CalendarDays, Check, Copy, Loader2, Send, Share2, X } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { T } from "@/components/i18n/t";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type QrState = "loading" | "ready" | "error";
type CopyState = "idle" | "done" | "error";

/** Snapshots read from browser APIs only after hydration. */
const subscribe = () => () => {};
const isClient = () => true;
const isServer = () => false;
const nativeShareAvailable = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const noNativeShare = () => false;
const clientOrigin = () =>
  typeof window === "undefined" ? "" : window.location.origin;
const serverOrigin = () => "";

/**
 * Share control for public profiles. Everything it offers — clipboard, native
 * share, Telegram and the QR image — uses the same absolute canonical URL.
 */
export function ShareProfile({
  path,
  title,
  bookingSlug,
}: {
  /** Canonical site path, e.g. `/barbers/<slug>` or `/shop/<slug>`. */
  path: string;
  /** Profile name, used as the share title. */
  title: string;
  /** When present, offer the one canonical short booking link. */
  bookingSlug?: string;
}) {
  const t = useT();
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);
  const canShare = useSyncExternalStore(subscribe, nativeShareAvailable, noNativeShare);
  const origin = useSyncExternalStore(subscribe, clientOrigin, serverOrigin);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  const [qrState, setQrState] = useState<QrState>("loading");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [shareError, setShareError] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathname = path.startsWith("/") ? path : `/${path}`;
  const url = origin ? `${origin}${pathname}` : "";

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 192, margin: 2, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (!cancelled) {
          setQr(dataUrl);
          setQrState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setQrState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );

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

  useEffect(
    () => () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    },
    [],
  );

  function openDialog() {
    setQr("");
    setQrState("loading");
    setCopyState("idle");
    setShareError(false);
    setOpen(true);
  }

  function flashCopy(state: CopyState) {
    setCopyState(state);
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCopyState("idle"), 2200);
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      flashCopy("done");
    } catch {
      // Clipboard can be unavailable in embedded webviews; fall back to a
      // temporary selection so the action still works there.
      try {
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        flashCopy(copied ? "done" : "error");
      } catch {
        flashCopy("error");
      }
    }
  }

  async function nativeShare() {
    if (!url) return;
    setShareError(false);
    try {
      await navigator.share({ title, text: t("share.text"), url });
    } catch (error) {
      // Dismissing the OS sheet is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError(true);
    }
  }

  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t("share.text"))}`;
  const bookingHref = bookingSlug ? `/b/${encodeURIComponent(bookingSlug)}` : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("share.open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDialog}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Share2 className="size-3.5" aria-hidden />
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-3">
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-profile-title"
                className="relative w-full max-w-xs rounded-2xl border border-border/70 bg-popover p-4 text-popover-foreground shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 id="share-profile-title" className="flex items-center gap-2 text-sm font-semibold">
                    <Share2 className="size-4 text-brand-strong" aria-hidden />
                    <T k="share.title" />
                  </h2>
                  <button
                    type="button"
                    aria-label={t("common.close")}
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-3 flex justify-center">
                  {qrState === "loading" ? (
                    <div className="flex size-44 items-center justify-center rounded-xl bg-muted text-muted-foreground" role="status">
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                      <span className="sr-only"><T k="share.qrLoading" /></span>
                    </div>
                  ) : qrState === "error" ? (
                    <p className="flex size-44 items-center justify-center rounded-xl bg-muted px-4 text-center text-xs text-muted-foreground" role="alert">
                      <T k="share.qrError" />
                    </p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr}
                      alt={t("share.qr")}
                      className="size-44 rounded-xl bg-muted object-contain p-1"
                    />
                  )}
                </div>

                <div role="group" aria-label={t("share.link")}>
                  <p className="mt-3 truncate text-center text-xs text-muted-foreground" title={url}>
                    {url}
                  </p>
                </div>

                {bookingHref ? (
                  <Link
                    href={bookingHref}
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "mt-3 flex w-full items-center justify-center gap-2 rounded-xl",
                    )}
                  >
                    <CalendarDays className="size-4" aria-hidden />
                    <T k="common.book" />
                  </Link>
                ) : null}

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {copyState === "done" ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Copy className="size-4" aria-hidden />
                    )}
                    <T k={copyState === "done" ? "share.copied" : "share.copy"} />
                  </button>
                  {canShare ? (
                    <button
                      type="button"
                      onClick={() => void nativeShare()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Share2 className="size-4" aria-hidden />
                      <T k="share.native" />
                    </button>
                  ) : null}
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Send className="size-4" aria-hidden />
                    <T k="share.telegram" />
                  </a>
                </div>

                <p className="mt-2 min-h-4 text-center text-xs" aria-live="polite">
                  {copyState === "error" ? (
                    <span className="text-destructive"><T k="share.copyError" /></span>
                  ) : shareError ? (
                    <span className="text-destructive"><T k="share.shareError" /></span>
                  ) : null}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
