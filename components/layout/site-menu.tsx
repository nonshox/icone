"use client";

import {
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  Compass,
  Languages,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/components/i18n/t";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useT } from "@/lib/i18n/use-t";
import { navSections } from "@/lib/navigation";
import { useLocaleStore, type Locale } from "@/lib/store/locale";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const sectionIcons = {
  "nav.discover": Compass,
  "nav.account": UserRound,
  "nav.forBarbers": BriefcaseBusiness,
  "nav.help": CircleHelp,
} as const;

const languages: Array<{ value: Locale; short: string; label: string }> = [
  { value: "uz", short: "UZ", label: "O'zbekcha" },
  { value: "ru", short: "RU", label: "Русский" },
  { value: "en", short: "EN", label: "English" },
];

const controlClass =
  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground";

/** One shadcn navigation panel shared by desktop and mobile. */
export function SiteMenu() {
  const pathname = usePathname();
  const t = useT();
  const open = useUIStore((state) => state.mobileNavOpen);
  const setOpen = useUIStore((state) => state.setMobileNavOpen);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <NavigationMenu
      align="end"
      value={open ? "site" : null}
      onValueChange={(value) => setOpen(value != null)}
      className="justify-end"
    >
      <NavigationMenuList>
        <NavigationMenuItem value="site">
          <NavigationMenuTrigger
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            className="h-9 gap-1.5 rounded-xl px-2.5 font-normal text-muted-foreground hover:text-foreground"
          >
            {t("nav.menu")}
          </NavigationMenuTrigger>

          <NavigationMenuContent className="max-h-[80dvh] w-[min(calc(100vw-1.5rem),22rem)] overflow-y-auto rounded-2xl bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
            <div className="grid gap-2">
              {navSections.map((section) => {
                const Icon = sectionIcons[section.title as keyof typeof sectionIcons] ?? Languages;
                return (
                  <section
                    key={section.title}
                    className="rounded-xl border border-border/70 p-2"
                  >
                    <h2 className="flex items-center gap-2 px-2 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      <Icon className="size-3.5 text-brand-strong" aria-hidden />
                      <T k={section.title} />
                    </h2>
                    <ul className="space-y-0.5">
                      {section.links.map((link) => {
                        const active =
                          pathname === link.href ||
                          pathname.startsWith(`${link.href}/`);
                        return (
                          <li key={link.href}>
                            <NavigationMenuLink
                              closeOnClick
                              active={active}
                              render={<Link href={link.href} />}
                              onClick={() => setOpen(false)}
                              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-foreground/[0.05]"
                            >
                              {t(link.label)}
                              <ChevronRight
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            </NavigationMenuLink>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

              <section className="flex items-center gap-2 rounded-xl border border-border/70 p-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 px-2 pb-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    <Languages className="size-3.5 text-brand-strong" aria-hidden />
                    <T k="nav.language" />
                  </p>
                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label={t("nav.language")}
                  >
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
                  className={cn(controlClass, "mt-5 size-9 shrink-0 justify-center p-0")}
                >
                  {isDark ? (
                    <Sun className="size-4" aria-hidden />
                  ) : (
                    <Moon className="size-4" aria-hidden />
                  )}
                </button>
              </section>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
