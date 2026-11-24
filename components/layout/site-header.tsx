"use client";

import { CalendarDays, Menu, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { HeaderBreadcrumbs } from "@/components/layout/header-breadcrumbs";
import { SiteMenu } from "@/components/layout/site-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { primaryLinks } from "@/lib/navigation";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const open = useUIStore((state) => state.mobileNavOpen);
  const setOpen = useUIStore((state) => state.setMobileNavOpen);
  const toggle = useUIStore((state) => state.toggleMobileNav);
  const close = () => setOpen(false);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-1">
          <Logo />
          <Suspense fallback={null}>
            <HeaderBreadcrumbs />
          </Suspense>
        </div>

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

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link
            href="/book"
            className={cn(
              buttonVariants({ size: "sm" }),
              "hidden h-9 gap-1.5 rounded-xl px-3 sm:inline-flex",
            )}
          >
            <CalendarDays className="size-4" aria-hidden />
            {t("nav.book")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-2.5"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={toggle}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
            <span className="hidden lg:inline">{t("nav.menu")}</span>
          </Button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={close}
          />
          <SiteMenu onNavigate={close} />
        </>
      ) : null}
    </header>
  );
}
