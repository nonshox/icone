"use client";

import {
  CalendarDays,
  CircleHelp,
  Compass,
  House,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "nav.home", Icon: House },
  { href: "/book", key: "nav.book", Icon: CalendarDays },
  { href: "/barbers", key: "nav.barbers", Icon: Compass },
  { href: "/services", key: "nav.services", Icon: Sparkles },
  { href: "/help", key: "nav.help", Icon: CircleHelp },
  { href: "/account", key: "nav.account", Icon: UserRound },
] as const;

function MobileNavInner() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
    >
      <div className="border-t border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto grid max-w-6xl grid-cols-6 gap-1 px-3 pt-1.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          {tabs.map(({ href, key, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2",
                  active && "bg-foreground/[0.06]",
                )}
              >
                <Icon
                  className={`size-5 ${active ? "text-brand-strong" : "text-muted-foreground"}`}
                  aria-hidden
                />
                {active ? (
                  <span className="text-[10px] font-medium text-foreground">
                    {t(key)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** Mobile-only bottom navigation. Desktop uses the full top bar instead. */
export function MobileNav() {
  return (
    <Suspense fallback={null}>
      <MobileNavInner />
    </Suspense>
  );
}
