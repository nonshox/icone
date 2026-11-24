"use client";

import { CalendarDays, ChevronDown, House, Menu, Scissors, UserRound, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect } from "react";

import { Logo } from "@/components/brand/logo";
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
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/barbers", label: "Barbers" },
  { href: "/services", label: "Services" },
] as const;

const accountLinks = [
  { href: "/bookings", label: "My visits" },
  { href: "/favorites", label: "Saved barbers" },
  { href: "/notifications", label: "Inbox" },
  { href: "/settings", label: "Settings" },
] as const;

const barberLinks = [
  { href: "/become-barber", label: "Become a barber" },
  { href: "/barber", label: "Business dashboard" },
  { href: "/agenda", label: "Agenda" },
] as const;

const helpLinks = [
  { href: "/help", label: "Help" },
  { href: "/support", label: "Contact" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
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
              {link.label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
              More
              <ChevronDown className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {accountLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {barberLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {helpLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="w-full">{link.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/account"
            aria-label="Account"
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
            <span className="hidden sm:inline">Book</span>
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
                <span className="flex items-center gap-2"><House className="size-4 text-brand-strong" aria-hidden /> Home</span>
              </MobileLink>
              <MobileLink href="/book" onNavigate={close}>
                <span className="flex items-center gap-2"><Scissors className="size-4 text-brand-strong" aria-hidden /> Book a chair</span>
              </MobileLink>
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Discover</p>
              {primary.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{link.label}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">My account</p>
              {accountLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{link.label}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">For barbers</p>
              {barberLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{link.label}</MobileLink>
              ))}
            </div>

            <div className="mt-3">
              <p className="px-3 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Help</p>
              {helpLinks.map((link) => (
                <MobileLink key={link.href} href={link.href} onNavigate={close}>{link.label}</MobileLink>
              ))}
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
