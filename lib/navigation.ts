/**
 * One source of truth for navigation. Labels are dictionary keys, resolved by
 * `useT()` in the components. Keep this file data-only so both the header and
 * the breadcrumbs can use it without pulling in client dependencies.
 */
export type NavLink = {
  href: string;
  label: string;
};

export type NavSection = {
  title: string;
  links: readonly NavLink[];
};

/** Links shown directly in the desktop bar. */
export const primaryLinks: readonly NavLink[] = [
  { href: "/barbers", label: "nav.barbers" },
  { href: "/map", label: "nav.map" },
  { href: "/services", label: "nav.services" },
];

/** The single menu panel, shared by desktop and mobile. */
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
    title: "nav.forBarbers",
    links: [
      { href: "/become-barber", label: "nav.becomeBarber" },
      { href: "/become-barber?model=b", label: "nav.openShop" },
    ],
  },
  {
    title: "nav.help",
    links: [{ href: "/help", label: "nav.help" }],
  },
];

/** Breadcrumb segment → dictionary key. Dynamic ids are handled separately. */
export const segmentLabelKeys: Record<string, string> = {
  admin: "nav.admin",
  account: "nav.account",
  applications: "nav.applications",
  barber: "nav.business",
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
  "sign-in": "nav.signIn",
  start: "nav.account",
  support: "nav.contact",
};
