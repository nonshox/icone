"use client";

import { ChevronLeft, ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useT } from "@/lib/i18n/use-t";

const labels: Record<string, string> = {
  barbers: "Barbers",
  book: "Book",
  bookings: "Visits",
  customer: "Home",
  barber: "Business",
  admin: "Admin",
  services: "Services",
  account: "Account",
  favorites: "Saved",
  notifications: "Inbox",
  settings: "Settings",
  messages: "Messages",
  "become-barber": "Become a barber",
  help: "Help",
  support: "Support",
  legal: "Legal",
  mini: "Telegram",
  start: "Account",
  "sign-in": "Sign in",
  applications: "Applications",
};

export function HeaderBreadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const dynamic = /^[a-zA-Z0-9_]{10,}$/.test(segment) || segment.includes("_");
    const label = dynamic
      ? index > 0 && segments[index - 1] === "bookings"
        ? "Visit"
        : "Profile"
      : (labels[segment] ?? segment);
    return { href, label, last: index === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb">
      <div className="glass mx-auto mt-2 flex h-12 max-w-6xl items-center gap-1 rounded-2xl px-1.5 text-xs text-muted-foreground sm:px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("nav.back")}
          className="inline-grid size-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <Link
          href="/"
          aria-label={t("nav.home")}
          className="inline-grid size-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <House className="size-4" aria-hidden />
        </Link>
        {crumbs.length > 0 ? (
          <div className="ml-1 hidden min-w-0 items-center gap-1.5 sm:flex">
            {crumbs.map((crumb) => (
              <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
                {crumb.last ? (
                  <span className="truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="truncate hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
