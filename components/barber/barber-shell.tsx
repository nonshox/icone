import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { currentMember } from "@/lib/domain/member";

const LINKS = [
  { href: "/barber", label: "Overview" },
  { href: "/barber/services", label: "Services" },
  { href: "/barber/customers", label: "Customers" },
  { href: "/barber/earnings", label: "Earnings" },
  { href: "/barber/promotions", label: "Offers" },
  { href: "/barber/portfolio", label: "Portfolio" },
  { href: "/barber/notifications", label: "Inbox" },
  { href: "/barber/settings", label: "Settings" },
];

export function BarberNav() {
  return (
    <nav
      aria-label="Business sections"
      className="flex flex-wrap gap-2 border-b border-border pb-4"
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Session check happens inside Suspense so the page shell stays static. */
export async function BarberGate({ children }: { children: ReactNode }) {
  const member = await currentMember();

  if (!member) {
    redirect("/sign-in?next=%2Fbarber");
  }
  if (member.profile.role === "admin") {
    redirect("/admin");
  }
  if (member.profile.role !== "barber") {
    redirect("/account");
  }

  return <>{children}</>;
}

export function BarberSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-hidden>
      <div className="h-9 w-full animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function BarberShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <div className="mt-6">
          <BarberNav />
          <Suspense fallback={<BarberSkeleton />}>
            <BarberGate>{children}</BarberGate>
          </Suspense>
        </div>
      </main>

    </div>
  );
}
