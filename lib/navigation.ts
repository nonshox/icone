/**
 * One source of truth for navigation. Labels are dictionary keys, resolved by
 * `useT()` in the components. Keep this file data-only so both the header and
 * the breadcrumbs can use it without pulling in client dependencies.
 */
import { publicConfig } from "@/lib/public-config";

export type NavLink = {
  href: string;
  label: string;
  /** External destinations get target/rel and are never marked as current. */
  external?: boolean;
};

/** Who a section is for. "customer" means any account without a professional row. */
export type NavAudience = "all" | "customer" | "professional";

export type NavSection = {
  title: string;
  links: readonly NavLink[];
  /** Omitted means "all". */
  audience?: NavAudience;
  /** Platform management stays separate from the role audiences. */
  adminOnly?: boolean;
};

/** Links shown directly in the desktop bar. */
export const primaryLinks: readonly NavLink[] = [
  { href: "/barbers", label: "nav.barbers" },
  { href: "/map", label: "nav.map" },
  { href: "/services", label: "nav.services" },
];

/**
 * Marketplace links and the global Book button are hidden inside the private
 * workspaces. Matching is segment-aware so `/barbers` and `/book` stay public.
 */
const WORKSPACE_PREFIXES = ["/barber", "/agenda", "/admin", "/b"] as const;

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The Telegram bot is the one external destination in the shared menu. */
const telegramLink: NavLink = {
  href: `https://t.me/${publicConfig.telegramBotUsername}`,
  label: "nav.telegram",
  external: true,
};

/**
 * The single link that invites a customer to the professional side. Shown once,
 * quietly — never as a whole "for barbers" section to customers.
 */
export const becomeBarberCta: NavLink = {
  href: "/become-barber",
  label: "nav.becomeBarber",
};

/**
 * The single menu panel, shared by the desktop dropdown, the mobile sheet and
 * the footer. Every link points at a real route (or the real Telegram bot).
 */
export const navSections: readonly NavSection[] = [
  {
    title: "nav.discover",
    links: [
      { href: "/barbers", label: "nav.barbers" },
      { href: "/map", label: "nav.map" },
      { href: "/services", label: "nav.services" },
    ],
  },
  {
    title: "customer.eyebrow",
    audience: "customer",
    links: [
      { href: "/bookings", label: "nav.myVisits" },
      { href: "/favorites", label: "nav.saved" },
      { href: "/messages", label: "nav.messages" },
      { href: "/waits", label: "nav.waitlist" },
    ],
  },
  {
    title: "nav.forBarbers",
    audience: "professional",
    links: [{ href: "/barber", label: "nav.workspace" }],
  },
  {
    title: "nav.admin",
    adminOnly: true,
    links: [{ href: "/admin", label: "nav.admin" }],
  },
  {
    title: "nav.help",
    links: [
      { href: "/help", label: "nav.help" },
      { href: "/support", label: "nav.contact" },
    ],
  },
  {
    title: "nav.legal",
    links: [
      { href: "/legal/terms", label: "nav.terms" },
      { href: "/legal/privacy", label: "nav.privacy" },
    ],
  },
  {
    title: "nav.telegram",
    links: [telegramLink],
  },
];

/**
 * Pure filter for the shared menu: a plain customer never sees professional
 * links repeated, while an approved professional keeps their customer links
 * *and* gets a workspace. Admins keep platform management.
 */
export function visibleNavSections(input: {
  professional?: boolean;
  admin?: boolean;
}): readonly NavSection[] {
  const professional = input.professional === true;

  return navSections.filter((section) => {
    if (section.adminOnly) return input.admin === true;
    if (!section.audience || section.audience === "all") return true;
    return section.audience === "professional" ? professional : !professional;
  });
}

/** Breadcrumb segment → dictionary key. Dynamic ids are handled separately. */
export const segmentLabelKeys: Record<string, string> = {
  admin: "nav.admin",
  account: "nav.account",
  applications: "nav.applications",
  barber: "nav.workspace",
  barbers: "nav.barbers",
  "become-barber": "nav.becomeBarber",
  book: "nav.book",
  bookings: "nav.myVisits",
  customer: "nav.home",
  favorites: "nav.saved",
  help: "nav.help",
  legal: "nav.legal",
  invites: "nav.team",
  map: "nav.map",
  messages: "nav.messages",
  notifications: "nav.inbox",
  waits: "nav.waitlist",
  services: "nav.services",
  settings: "nav.settings",
  shop: "nav.business",
  "sign-in": "nav.signIn",
  start: "nav.account",
  support: "nav.contact",
};
