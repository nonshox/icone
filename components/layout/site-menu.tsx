"use client";

import {
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  Compass,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { navSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const sectionIcons = {
  "nav.discover": Compass,
  "nav.account": UserRound,
  "nav.forBarbers": BriefcaseBusiness,
  "nav.help": CircleHelp,
} as const;

/** One compact panel shared by desktop and mobile, built from lib/navigation. */
export function SiteMenu({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      id="site-menu"
      aria-label={t("nav.menu")}
      className="glass animate-in fade-in-0 slide-in-from-top-1 absolute inset-x-3 z-50 mt-2 max-h-[75dvh] overflow-y-auto rounded-2xl p-2 sm:inset-x-5"
    >
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {navSections.map((section) => {
          const Icon =
            sectionIcons[section.title as keyof typeof sectionIcons] ?? Compass;
          return (
            <div key={section.title} className="rounded-xl border border-border/70 p-2">
              <p className="flex items-center gap-2 px-2 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                <Icon className="size-3.5 text-brand-strong" aria-hidden />
                <T k={section.title} />
              </p>
              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const active =
                    pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.05]",
                        active ? "font-medium text-foreground" : "text-foreground/80",
                      )}
                    >
                      <span>{t(link.label)}</span>
                      <ChevronRight
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
