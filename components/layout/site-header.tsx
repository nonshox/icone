"use client";

import { CalendarDays, ChevronDown, House, Menu, Scissors, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { HeaderBreadcrumbs } from "@/components/layout/header-breadcrumbs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/use-t";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/barbers", key: "nav.barbers" },
  { href: "/services", key: "nav.services" },
] as const;

const accountLinks = [
  { href: "/bookings", key: "nav.myVisits" },
  { href: "/favorites", key: "nav.saved" },
  { href: "/notifications", key: "nav.inbox" },
  { href: "/settings", key: "nav.settings" },
] as const;

const barberLinks = [
  { href: "/become-barber", key: "nav.becomeBarber" },
  { href: "/barber", key: "nav.business" },
  { href: "/agenda", key: "nav.agenda" },
] as const;

const helpLinks = [
  { href: "/help", key: "nav.help" },
  { href: "/support", key: "nav.contact" },
  { href: "/legal/privacy", key: "nav.privacy" },
  { href: "/legal/terms", key: "nav.terms" },
] as const;

function MobileLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.05]"
    >
      {children}
      <span aria-hidden className="text-muted-foreground">→</span>
    </Link>
  );
}

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
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {primary.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              {t(link.key)}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
              {t("nav.more")}
              <ChevronDown className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {accountLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{t(link.key)}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {barberLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{t(link.key)}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {helpLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{t(link.key)}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link
            href="/account"
            aria-label={t("nav.account")}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-9 rounded-xl",
            )}
          >
            <UserRound className="size-4" aria-hidden />
          </Link>
          <Link
            href="/book"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 gap-1.5 rounded-xl px-3",
            )}
          >
            <CalendarDays className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("nav.book")}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={toggle}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <Suspense fallback={null}>
        <HeaderBreadcrumbs />
      </Suspense>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={close}
          />
          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="glass animate-in fade-in-0 slide-in-from-top-1 absolute inset-x-3 z-50 mt-2 max-h-[75dvh] overflow-y-auto rounded-2xl p-3 sm:inset-x-5 lg:hidden"
          >
            <div className="space-y-1">
              <MobileLink href="/" onNavigate={close}>
                <span className="flex items-center gap-2"><House className="size-4 text-brand-strong" aria-hidden /> {t("nav.home")}</span>
              </MobileLink>
              <MobileLink href="/book" onNavigate={close}>
                <span className="flex items-center gap-2"><Scissors className="size-4 text-brand-strong" aria-hidden /> {t("nav.book")}</span>
              </MobileLink>
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">{t("nav.discover")}</p>
              {primary.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{t(link.key)}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">{t("nav.account")}</p>
              {accountLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{t(link.key)}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">{t("nav.forBarbers")}</p>
              {barberLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{t(link.key)}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">{t("nav.help")}</p>
              {helpLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{t(link.key)}</MobileLink>
              ))}
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
