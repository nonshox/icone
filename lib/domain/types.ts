/**
 * Domain types. Every entity the product knows about lives here so route
 * handlers, views and queries all speak the same language.
 *
 * Field names match the Appwrite keys one-for-one; see docs/DATA.md.
 */

/* ------------------------------------------------------------- primitives */

export type Role = "client" | "barber" | "admin";

export type Locale = "uz" | "ru" | "en";

/** Business membership roles, most privileged first. */
export const TEAM_ROLES = ["owner", "manager", "reception", "barber"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** The four booking states, plus the two terminal ones. */
export const STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "done",
  "noshow",
] as const;
export type Status = (typeof STATUSES)[number];

/**
 * Statuses that hold a slot open on the calendar. This is the one authority
 * for "does this appointment occupy a future chair?" — compare with
 * `isHolding()` rather than spelling out statuses at call sites.
 *
 * `done` is deliberately absent: a finished visit is history, the client has
 * left, and the chair must be bookable again. It still counts as a visit in
 * the CRM (`isVisit`) and as completed revenue, but it never blocks a slot.
 * `BUSY_STATUSES` is retained as an alias for any older callers.
 */
export const HOLDING_STATUSES: readonly Status[] = ["pending", "confirmed"];
export const BUSY_STATUSES: readonly Status[] = HOLDING_STATUSES;

export function isHolding(status: Status): boolean {
  return HOLDING_STATUSES.includes(status);
}

/** Statuses a customer can still walk away from without a record of blame. */
export const CANCELLABLE: readonly Status[] = HOLDING_STATUSES;

export function isCancellable(status: Status): boolean {
  return CANCELLABLE.includes(status);
}

/**
 * Statuses that count as a visit in the CRM — the person was seen or is still
 * expected. Wider than `HOLDING_STATUSES` because completed visits belong in
 * a customer's history even though they no longer hold a future slot.
 */
export const VISIT_STATUSES: readonly Status[] = ["pending", "confirmed", "done"];

export function isVisit(status: Status): boolean {
  return VISIT_STATUSES.includes(status);
}

/** A visit that actually finished; historical, but real revenue and history. */
export const COMPLETED_STATUSES: readonly Status[] = ["done"];

export function isCompleted(status: Status): boolean {
  return COMPLETED_STATUSES.includes(status);
}

/** Terminal states where the appointment will not take place. */
export const DISMISSED_STATUSES: readonly Status[] = [
  "cancelled",
  "rejected",
  "noshow",
];

export function isDismissed(status: Status): boolean {
  return DISMISSED_STATUSES.includes(status);
}

export type StatusLabel = Record<Status, string>;

/** Neutral labels used where no dictionary key is available yet. */
export const STATUS_LABEL: StatusLabel = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  done: "Completed",
  noshow: "No-show",
};

/** Where an appointment came from. */
export type Source = "online" | "walkin" | "phone" | "manual";

/* --------------------------------------------------------------- accounts */

export type Profile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  avatar: string;
  locale: Locale;
  plan: string;
  state: "active" | "suspended";
  /** Notification toggles, parsed from `users.prefs`. */
  prefs: NotificationPrefs;
};

/** Defaults applied when a member has never saved preferences. */
export const DEFAULT_PREFS = {
  booking: true,
  reminder: true,
  waitlist: true,
  business: true,
} as const;

export type NotificationPrefs = {
  booking: boolean;
  reminder: boolean;
  waitlist: boolean;
  business: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
};

/* ------------------------------------------------------ professional side */

/** Lifecycle of a professional or business account. */
export const PRO_STATES = ["draft", "active", "suspended"] as const;
export type ProState = (typeof PRO_STATES)[number];

export type Barber = {
  id: string;
  user: string;
  /** Empty for an independent barber; a business id for a shop employee. */
  business: string;
  /** Default branch for a shop employee; empty for an independent barber. */
  branch: string;
  name: string;
  title: string;
  slug: string;
  bio: string;
  photo: string;
  cover: string;
  rating: number;
  active: boolean;
  state: ProState;
  verified: boolean;
  featured: boolean;
  /** Independent-barber location; shop employees inherit from the branch. */
  shop: string;
  address: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  years: number;
  skills: string;
  langs: string;
  phone: string;
  social: string;
  facilities: string;
  policy: string;
  /** true = the barber approves each request, false = instant confirmation. */
  confirm: boolean;
  buffer: number;
  step: number;
  views: number;
};

export type Business = {
  id: string;
  owner: string;
  name: string;
  slug: string;
  logo: string;
  cover: string;
  about: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  facilities: string;
  policy: string;
  web: string;
  confirm: boolean;
  state: "draft" | "review" | "active" | "suspended";
  verified: boolean;
  active: boolean;
  plan: string;
  rating: number;
  seats: number;
  buffer: number;
  step: number;
  views: number;
};

export type Branch = {
  id: string;
  business: string;
  name: string;
  slug: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  note: string;
  active: boolean;
  primary: boolean;
  sort: number;
};

export type Membership = {
  id: string;
  business: string;
  user: string;
  barber: string;
  branch: string;
  role: TeamRole;
  state: "invited" | "active" | "suspended" | "removed";
  perms: Record<string, boolean>;
  active: boolean;
};

export type Invite = {
  id: string;
  business: string;
  role: TeamRole;
  to: string;
  phone: string;
  name: string;
  token: string;
  by: string;
  branch: string;
  state: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expires: string;
};

/* --------------------------------------------------------------- services */

export type Service = {
  id: string;
  /** Independent barber owner; empty when `business` owns it. */
  barber: string;
  /** Shared barbershop catalogue; empty for independent-barber services. */
  business: string;
  name: string;
  note: string;
  price: number;
  time: number;
  buffer: number;
  active: boolean;
  image: string;
  category: string;
  featured: boolean;
  sort: number;
};

/** A shared service as one employee offers it. -1 means "inherit". */
export type EmployeeService = {
  id: string;
  business: string;
  barber: string;
  service: string;
  price: number;
  time: number;
  active: boolean;
  sort: number;
};

/** A service resolved to what one specific employee actually charges. */
export type OfferedService = Service & {
  /** The employee-specific price, or the catalogue price when not overridden. */
  ownPrice: number;
  ownTime: number;
  assigned: boolean;
};

/** Flat offer shape used when a booking item is stored with its own details. */
export type Offer = {
  id: string;
  barber: string;
  service: string;
  business: string;
  price: number;
  time: number;
  active: boolean;
  sort: number;
};

/* --------------------------------------------------------------- schedule */

/** Who a schedule row belongs to. */
export type Scope = "barber" | "branch";

export type Window = { start: number; end: number };

export type HourRow = Window & { day: number; scope: Scope };

export type BreakRow = Window & { day: number; scope: Scope; note: string };

export type DayRow = Window & {
  date: string;
  open: boolean;
  note: string;
  scope: Scope;
};

/* ---------------------------------------------------------- appointments */

export type Booking = {
  id: string;
  user: string;
  client: string;
  barber: string;
  service: string;
  /** Every service booked in this visit, primary first. */
  items: string[];
  business: string;
  branch: string;
  date: string;
  start: number;
  end: number;
  price: number;
  status: Status;
  source: Source;
  note: string;
  innote: string;
  createdby: string;
  created: string;
};

/** A booking with the names the UI needs, resolved server-side. */
export type BookingRow = Booking & {
  barberName: string;
  serviceName: string;
  serviceTime: number;
  customerName: string;
  customerPhone: string;
  customerAvatar: string;
  businessName: string;
  branchName: string;
  reviewed?: boolean;
};

export type AppointmentLogEntry = {
  id: string;
  booking: string;
  from: Status | "";
  to: Status;
  by: string;
  note: string;
  kind: string;
  at: string;
};

/**
 * One service as it looked when the appointment was created. Stored on the
 * booking so an old visit keeps its name and price after the catalogue changes.
 */
export type BookingItemSnapshot = {
  service: string;
  name: string;
  price: number;
  time: number;
};

/** A customer without an account — walk-ins and phone bookings. */
export type Client = {
  id: string;
  business: string;
  barber: string;
  user: string;
  name: string;
  phone: string;
  note: string;
  active: boolean;
};

/** CRM view of one customer, with the account ids that resolve to them. */
export type CustomerRecord = {
  id: string;
  business: string;
  user: string;
  phone: string;
  name: string;
  note: string;
  active: boolean;
  aliases: string[];
};

/** A direct-message thread between two accounts. */
export type ConversationRecord = {
  id: string;
  pair: string;
  id1: string;
  id2: string;
  last: string;
  /** Epoch milliseconds in Appwrite; ISO string only in the public DTO. */
  lastAt: string | number;
  unread1: number;
  unread2: number;
};

/* -------------------------------------------------------------- discovery */

export type Review = {
  id: string;
  user: string;
  barber: string;
  booking: string;
  rate: number;
  note: string;
  reply: string;
  state: "open" | "hidden" | "reported";
  business: string;
  created: string;
  userName: string;
  userAvatar: string;
};

export type Slot = {
  start: number;
  end: number;
  label: string;
};

export type PortfolioItem = {
  id: string;
  barber: string;
  url: string;
  note: string;
  group: string;
  sort: number;
  featured: boolean;
  public: boolean;
};

export type Place = {
  id: string;
  name: string;
  ru: string;
  en: string;
  kind: "city" | "district";
  parent: string;
  lat: number;
  lng: number;
  sort: number;
  active: boolean;
};

/* ------------------------------------------------------------- onboarding */

export const APP_STATES = [
  "draft",
  "submitted",
  "review",
  "info",
  "approved",
  "rejected",
  "suspended",
] as const;
export type AppState = (typeof APP_STATES)[number];

export type Application = {
  id: string;
  user: string;
  /** a = independent barber, b = barbershop with a team. */
  model: "a" | "b";
  state: AppState;
  target: string;
  name: string;
  shop: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  bio: string;
  note: string;
  reason: string;
  history: ApplicationStep[];
  created: string;
};

export type ApplicationStep = {
  state: AppState;
  at: string;
  by: string;
  note: string;
};

/* --------------------------------------------------------------- platform */

export type Waitlist = {
  id: string;
  user: string;
  business: string;
  branch: string;
  barber: string;
  service: string;
  from: string;
  to: string;
  day: number;
  before: number;
  note: string;
  state: "open" | "notified" | "booked" | "cancelled" | "expired";
};

export type Report = {
  id: string;
  reporter: string;
  kind: "user" | "barber" | "review" | "booking" | "business" | "other";
  target: string;
  note: string;
  detail: string;
  state: "open" | "review" | "resolved" | "rejected";
  actor: string;
  created: string;
};

export type Ticket = {
  id: string;
  user: string;
  topic: string;
  body: string;
  reply: string;
  state: "open" | "answered" | "closed";
  actor: string;
  created: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  kind: string;
  target: string;
  detail: string;
  at: string;
};

export type Notification = {
  id: string;
  user: string;
  title: string;
  body: string;
  kind: string;
  state: "new" | "read";
  link: string;
  created: string;
};
