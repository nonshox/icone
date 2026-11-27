"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { HeaderBreadcrumbs } from "@/components/layout/header-breadcrumbs";
import { SiteMenu } from "@/components/layout/site-menu";
import { GlobalSearch } from "@/components/search/global-search";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { primaryLinks } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const t = useT();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-1">
          <Logo />
          <div className="hidden md:block">
            <Suspense fallback={null}>
              <HeaderBreadcrumbs />
            </Suspense>
          </div>
        </div>

        {/* Search is a single icon on every viewport; its dialog keeps the
            mobile bar uncluttered. Desktop links stay in their own group. */}
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <div className="hidden items-center gap-2 md:flex">
            <nav className="hidden items-center gap-1 lg:flex" aria-label={t("nav.main")}>
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  {t(link.label)}
                </Link>
              ))}
            </nav>
            <Link
              href="/book"
              className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5 rounded-xl px-3")}
            >
              <CalendarDays className="size-4" aria-hidden />
              {t("nav.book")}
            </Link>
            <SiteMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
