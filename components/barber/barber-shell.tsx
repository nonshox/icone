import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { BusinessSwitcher } from "@/components/barber/business-switcher";
import { NavPills } from "@/components/barber/barber-ui";
import {
  activeBusiness,
  activeBusinessId,
  businessOptions,
  can,
  canSwitchBusiness,
  getActor,
  hasTeam,
  isOwner,
  type Capability,
} from "@/lib/domain/access";

/** Work tools every professional gets, independent barbers included. */
const BASE_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/agenda", label: "nav.calendar" },
  { href: "/bookings", label: "nav.appointments" },
  { href: "/barber/services", label: "nav.services" },
  { href: "/barber/customers", label: "work.customers.title" },
  { href: "/barber/settings", label: "nav.settings" },
];

/** Business-level tools: only for an owner inside a real workspace. */
const OWNER_LINKS: ReadonlyArray<{ href: string; label: string; cap: Capability }> = [
  { href: "/barber/team", label: "nav.team", cap: "team.read" },
  { href: "/barber/branches", label: "nav.branches", cap: "branch.read" },
];

/** Owners see shop analytics; independents see their own with the capability. */
const ANALYTICS_LINK = {
  href: "/barber/analytics",
  label: "nav.analytics",
  cap: "analytics.read",
} as const satisfies { href: string; label: string; cap: Capability };

export async function BarberNav() {
  const actor = await getActor();
  const business = actor ? activeBusinessId(actor) : "";
  const team = !!actor && hasTeam(actor) && !!business;
  const owner = !!actor && team && isOwner(actor, business);
  const independent = !!actor && !team && !!actor.barber;

  const ownerLinks = owner
    ? OWNER_LINKS.filter((link) => !!actor && can(actor, link.cap, { business }))
    : [];
  const analytics =
    !!actor &&
    (owner
      ? can(actor, ANALYTICS_LINK.cap, { business })
      : independent &&
        can(actor, ANALYTICS_LINK.cap, { barber: actor.barber?.id }))
      ? [ANALYTICS_LINK]
      : [];

  return (
    <NavPills
      links={[...BASE_LINKS, ...ownerLinks, ...analytics]}
      labelKey="nav.business"
    />
  );
}

/**
 * Owners and managers get a compact business/location picker in the workspace
 * header. The choice is UI-only: it lives in plain cookies and never changes a
 * membership, a booking context or any other server row.
 */
async function WorkspaceSwitcher() {
  const actor = await getActor();
  if (!actor || !canSwitchBusiness(actor)) return null;

  const [active, options] = await Promise.all([
    activeBusiness(actor),
    businessOptions(actor),
  ]);
  if (options.length === 0) return null;

  return <BusinessSwitcher active={active} options={options} />;
}

/** Session check happens inside Suspense so the page shell stays static. */
export async function BarberGate({
  children,
  signInNext = "/barber",
}: {
  children: ReactNode;
  signInNext?: string;
}) {
  const actor = await getActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(signInNext)}`);
  }
  if (actor.profile.role === "admin") redirect("/admin");
  // A promoted account can still book as a customer: only a chair or an
  // active membership makes this account a professional.
  if (!actor.summary.professional) redirect("/account");

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
  signInNext = "/barber",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Preserves each workspace page's own sign-in destination. */
  signInNext?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-2 sm:px-6">
        <Suspense fallback={null}>
          <WorkspaceSwitcher />
        </Suspense>
      </div>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}

        <div className="mt-6">
          <Suspense fallback={<BarberSkeleton />}>
            <BarberNav />
          </Suspense>
          <Suspense fallback={<BarberSkeleton />}>
            <BarberGate signInNext={signInNext}>{children}</BarberGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
