"use client";

import {
  BriefcaseBusiness,
  CircleHelp,
  Compass,
  Languages,
  Menu,
  Moon,
  Scale,
  Send,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { navSections } from "@/lib/navigation";
import { useLocaleStore, type Locale } from "@/lib/store/locale";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

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

const controlClass =
  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground";

/** Clean dropdown panel for the desktop navbar. Mobile uses the bottom bar. */
export function SiteMenu() {
  const pathname = usePathname();
  const t = useT();
  const open = useUIStore((state) => state.mobileNavOpen);
  const setOpen = useUIStore((state) => state.setMobileNavOpen);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 font-normal text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <Menu className="size-4" aria-hidden />
        <span className="text-sm">{t("nav.menu")}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(70dvh,32rem)] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto rounded-2xl border border-border/70 bg-popover p-2 text-popover-foreground shadow-lg">
          {navSections.map((section) => {
            const Icon = sectionIcons[section.title as keyof typeof sectionIcons] ?? Languages;
            const headingId = `menu-${section.title.replace(/\./g, "-")}`;
            return (
              <section key={section.title} aria-labelledby={headingId} className="rounded-xl p-2">
                <h2
                  id={headingId}
                  className="flex items-center gap-2 px-2 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase"
                >
                  <Icon className="size-3.5 text-brand-strong" aria-hidden />
                  <T k={section.title} />
                </h2>
                <ul className="space-y-1">
                  {section.links.map((link) => {
                    // Query variants (e.g. ?model=b) are reachable but not
                    // highlighted, since the pathname alone cannot tell them apart.
                    const path = link.href.split("?")[0];
                    const active = !link.external && !link.href.includes("?") && pathname === path;
                    const className = cn(
                      "block rounded-lg px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                    );

                    return (
                      <li key={link.href}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={className}
                          >
                            {t(link.label)}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={className}
                          >
                            {t(link.label)}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <div className="my-2 h-px bg-border/70" />

          <section className="flex items-center gap-2 rounded-xl p-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 px-2 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
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
              className={cn(controlClass, "size-9 shrink-0 justify-center p-0")}
            >
              {isDark ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
