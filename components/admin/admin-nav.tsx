"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", key: "admin.nav.dashboard" },
  { href: "/admin/users", key: "admin.nav.users" },
  { href: "/admin/barbers", key: "admin.nav.barbers" },
  { href: "/admin/appointments", key: "admin.nav.appointments" },
  { href: "/admin/moderation", key: "admin.nav.moderation" },
  { href: "/admin/reports", key: "admin.nav.reports" },
  { href: "/admin/settings", key: "admin.nav.settings" },
  { href: "/admin/applications", key: "admin.nav.applications" },
] as const;

const pillClass =
  "inline-flex items-center rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function AdminNav() {
  const pathname = usePathname();
  const t = useT();
  const active = LINKS.filter(
    (link) =>
      link.href === "/admin"
        ? pathname === "/admin"
        : pathname === link.href || pathname.startsWith(`${link.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={t("nav.admin")}
      className="flex flex-wrap gap-2 border-b border-border pb-4"
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active === link.href ? "page" : undefined}
          className={cn(
            pillClass,
            active === link.href &&
              "border-brand/50 bg-brand/10 text-foreground",
          )}
        >
          <T k={link.key} />
        </Link>
      ))}
    </nav>
  );
}
