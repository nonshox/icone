"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  Compass,
  House,
  Languages,
  Moon,
  MoreHorizontal,
  Send,
  Scale,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { navSections } from "@/lib/navigation";
import { useLocaleStore, type Locale } from "@/lib/store/locale";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "nav.home", Icon: House },
  { href: "/book", key: "nav.book", Icon: CalendarDays },
  { href: "/barbers", key: "nav.barbers", Icon: Compass },
  { href: "/help", key: "nav.help", Icon: CircleHelp },
  { href: "/account", key: "nav.account", Icon: UserRound },
] as const;

const sectionIcons = {
  "nav.discover": Compass,
  "nav.forBarbers": BriefcaseBusiness,
  "nav.help": CircleHelp,
  "nav.legal": Scale,
  "nav.telegram": Send,
} as const;

const languages: Array<{ value: Locale; short: string; label: string }> = [
  { value: "uz", short: "UZ", label: "O'zbekcha" },
  { value: "ru", short: "RU", label: "Русский" },
  { value: "en", short: "EN", label: "English" },
];

function MobileNavInner() {
  const pathname = usePathname();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-[55] bg-background/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[60] max-h-[70dvh] overflow-y-auto rounded-2xl border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <p className="text-sm font-medium">{t("nav.menu")}</p>
              <button
                type="button"
                aria-label={t("nav.closeMenu")}
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {navSections.map((section) => {
              const Icon = sectionIcons[section.title as keyof typeof sectionIcons] ?? Compass;
              const headingId = `mobile-menu-${section.title.replace(/\./g, "-")}`;
              return (
                <section key={section.title} aria-labelledby={headingId} className="py-2">
                  <h2
                    id={headingId}
                    className="flex items-center gap-2 px-1 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    <Icon className="size-3.5 text-brand-strong" aria-hidden />
                    <T k={section.title} />
                  </h2>
                  <ul className="space-y-0.5">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg px-1 py-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            {t(link.label)}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            onClick={() => setMoreOpen(false)}
                            className="block rounded-lg px-1 py-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            {t(link.label)}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 px-1 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  <Languages className="size-3.5 text-brand-strong" aria-hidden />
                  <T k="nav.language" />
                </p>
                <div className="flex gap-1" role="group" aria-label={t("nav.language")}>
                  {languages.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      aria-pressed={locale === option.value}
                      onClick={() => setLocale(option.value)}
                      className={cn(
                        "h-8 flex-1 rounded-lg px-2 text-xs font-medium transition-colors",
                        locale === option.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                      )}
                    >
                      {option.short}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-label={t("nav.theme")}
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
              >
                {isDark ? (
                  <Sun className="size-4" aria-hidden />
                ) : (
                  <Moon className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </>
      ) : null}

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
            <button
              type="button"
              aria-label={t("nav.more")}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2",
                moreOpen && "bg-foreground/[0.06]",
              )}
            >
              <MoreHorizontal
                className={`size-5 ${moreOpen ? "text-brand-strong" : "text-muted-foreground"}`}
                aria-hidden
              />
              {moreOpen ? (
                <span className="text-[10px] font-medium text-foreground">
                  {t("nav.more")}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </nav>
    </>
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
