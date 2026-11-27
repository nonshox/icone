import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { T } from "@/components/i18n/t";
import { getActor, hasTeam, can, type Capability } from "@/lib/domain/access";

/** Links shown to every professional, independent barbers included. */
const BASE_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/barber", label: "nav.account" },
  { href: "/agenda", label: "nav.agenda" },
  { href: "/barber/services", label: "nav.services" },
  { href: "/barber/customers", label: "nav.myVisits" },
  { href: "/barber/portfolio", label: "nav.profile" },
  { href: "/barber/notifications", label: "nav.inbox" },
  { href: "/barber/settings", label: "nav.settings" },
];

/** Shown only inside a business with a team. */
const TEAM_LINKS: ReadonlyArray<{ href: string; label: string; cap: Capability }> = [
  { href: "/barber/team", label: "nav.team", cap: "team.read" },
  { href: "/barber/branches", label: "nav.branches", cap: "branch.read" },
  { href: "/barber/analytics", label: "nav.analytics", cap: "analytics.read" },
];

export async function BarberNav() {
  const actor = await getActor();
  const team = !!actor && hasTeam(actor);
  const business =
    actor?.owns[0] ?? actor?.memberships[0]?.business ?? "";
  const links = [
    ...BASE_LINKS,
    ...(team
      ? TEAM_LINKS.filter(
          (link) => !!actor && can(actor, link.cap, { business }),
        )
      : []),
  ];

  return (
    <nav
      aria-label="Business sections"
      className="flex flex-wrap gap-2 border-b border-border pb-4"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground"
        >
          <T k={link.label} />
        </Link>
      ))}
    </nav>
  );
}

/** Session check happens inside Suspense so the page shell stays static. */
export async function BarberGate({ children }: { children: ReactNode }) {
  const actor = await getActor();

  if (!actor) redirect("/sign-in?next=%2Fbarber");
  if (actor.profile.role === "admin") redirect("/admin");
  if (!actor.barber && actor.memberships.length === 0) redirect("/account");

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
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}

        <div className="mt-6">
          <Suspense fallback={<BarberSkeleton />}>
            <BarberNav />
          </Suspense>
          <Suspense fallback={<BarberSkeleton />}>
            <BarberGate>{children}</BarberGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
