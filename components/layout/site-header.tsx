"use client";

import { CalendarDays, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#services", label: "Services" },
  { href: "/#how", label: "How it works" },
  { href: "/#hours", label: "Hours" },
] as const;

const mobileLinks = [
  { href: "/book", label: "Book a chair" },
  { href: "/bookings", label: "My visits" },
  ...links,
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const open = useUIStore((state) => state.mobileNavOpen);
  const setOpen = useUIStore((state) => state.setMobileNavOpen);
  const toggle = useUIStore((state) => state.toggleMobileNav);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

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
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-3 sm:px-5">
        <Logo />

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
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
              "h-9 rounded-xl px-3.5",
            )}
          >
            <CalendarDays className="size-4" aria-hidden />
            <span className="hidden sm:inline">Book</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={toggle}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="glass animate-in fade-in-0 slide-in-from-top-1 mx-auto mt-2 max-w-6xl rounded-2xl p-2 duration-200 md:hidden"
        >
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.05]"
            >
              {link.label}
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
