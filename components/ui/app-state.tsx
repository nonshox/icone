"use client";

import type { ReactNode } from "react";

import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Server validation copy is English; never leak it into a localized UI. */
export function message(_error: unknown, fallback: string): string {
  return fallback;
}

export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" aria-live="polite" className="text-sm text-destructive">
      {text}
    </p>
  );
}

/** The single empty surface for customer, professional and admin data views. */
export function EmptyState({
  children,
  title,
  description,
  icon,
  action,
  className,
}: {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const body = children ?? description;
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-8 sm:items-center sm:text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-brand-strong"
        >
          {icon}
        </span>
      ) : null}
      {title ? <p className="font-medium">{title}</p> : null}
      {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/** The single error surface. The text is always the localized fallback. */
export function ErrorState({
  error,
  fallback,
  title,
  onRetry,
  className,
}: {
  error?: unknown;
  fallback: string;
  title?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const text = message(error, fallback);
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 sm:items-center sm:text-center",
        className,
      )}
    >
      {title ? <p className="font-medium text-destructive">{title}</p> : null}
      <p className="text-sm text-destructive">{text}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onRetry}
        >
          <T k="common.tryAgain" />
        </Button>
      ) : null}
    </div>
  );
}

/** One loading skeleton for every list or grid of rows. */
export function LoadingRows({
  count = 3,
  className,
  rowClassName,
}: {
  count?: number;
  className?: string;
  rowClassName?: string;
}) {
  return (
    <div className={cn("space-y-2 py-2", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn("h-9 w-full", rowClassName)} />
      ))}
    </div>
  );
}
