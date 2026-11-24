"use client";

import { ChevronLeft, ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useT } from "@/lib/i18n/use-t";
import { segmentLabelKeys } from "@/lib/navigation";

/** Compact breadcrumb group rendered inside the navbar, not as a second bar. */
export function HeaderBreadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const dynamic = /^[a-zA-Z0-9_]{10,}$/.test(segment) || segment.includes("_");
    const label = dynamic
      ? index > 0 && segments[index - 1] === "bookings"
        ? t("nav.visit")
        : t("nav.profile")
      : t(segmentLabelKeys[segment] ?? segment);
    return { href, label, last: index === segments.length - 1 };
  });

  return (
    <nav aria-label={t("nav.breadcrumb")} className="flex min-w-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("nav.back")}
        className="inline-grid size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
      </button>
      <Link
        href="/"
        aria-label={t("nav.home")}
        className="hidden size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-foreground/[0.05] hover:text-foreground sm:inline-grid"
      >
        <House className="size-3.5" aria-hidden />
      </Link>
      <span
        aria-hidden
        className="mx-1 hidden h-4 w-px shrink-0 bg-border/70 sm:block"
      />
      <div className="hidden min-w-0 items-center gap-1 md:flex">
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3 shrink-0 opacity-40" aria-hidden />
            {crumb.last ? (
              <span className="max-w-[18ch] truncate text-xs font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="max-w-[18ch] truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
