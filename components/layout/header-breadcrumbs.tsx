"use client";

import { ChevronLeft, ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
    <nav
      aria-label="Breadcrumb"
      className="mx-auto mt-2 flex max-w-6xl items-center gap-1.5 px-2 text-xs text-muted-foreground sm:px-4"
    >
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Back
      </button>
      <ChevronRight className="size-3 opacity-50" aria-hidden />
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:text-foreground"
      >
        <House className="size-3.5" aria-hidden />
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="size-3 opacity-50" aria-hidden />
          {crumb.last ? (
            <span className="truncate font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="truncate hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
