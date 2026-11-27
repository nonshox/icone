"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/components/i18n/t";

const LINKS = [
  { href: "/admin", key: "admin.nav.dashboard" },
  { href: "/admin/users", key: "admin.nav.users" },
  { href: "/admin/barbers", key: "admin.nav.barbers" },
  { href: "/admin/appointments", key: "admin.nav.appointments" },
  { href: "/admin/moderation", key: "admin.nav.moderation" },
  { href: "/admin/reports", key: "admin.nav.reports" },
  { href: "/admin/settings", key: "admin.nav.settings" },
  { href: "/admin/catalogue", key: "admin.nav.catalogue" },
  { href: "/admin/applications", key: "admin.nav.applications" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-2 border-b pb-4"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                : "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            <T k={link.key} />
          </Link>
        );
      })}
    </nav>
  );
}
