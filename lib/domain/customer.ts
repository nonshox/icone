import "server-only";

import { AppwriteException, ID, Query, Users, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { createAdminClient } from "@/lib/appwrite/server";

import { getBarber, getMany, getProfile, listReviewsByUser } from "./data";
import { today } from "./time";
import { STATUS_LABEL, type BookingRow, type Profile } from "./types";
import { myBookings } from "./views";

/**
 * Tables added for the customer area. `lib/appwrite/db.ts` intentionally only
 * lists the tables the core booking flow needs, so these ids live here.
 */
const FAVORITES = "favorites";
const NOTIFICATIONS = "notifications";
const PORTFOLIO = "portfolio";
const PROMOTIONS = "promotions";

type Row = Models.Document & Record<string, unknown>;

/* ------------------------------------------------------------------ types */

export type Favorite = {
  id: string;
  barber: string;
  name: string;
  title: string;
  photo: string;
  rating: number;
  shop: string;
  address: string;
  city: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  state: "unread" | "read";
  created: string;
};

export type NotifyPrefs = {
  bookings: boolean;
  reminders: boolean;
  offers: boolean;
};

export type SettingsData = {
  profile: Profile;
  prefs: NotifyPrefs;
};

export type CustomerStats = {
  upcoming: number;
  completed: number;
  cancelled: number;
  favorites: number;
  reviews: number;
  unread: number;
};

export type CustomerActivity = {
  id: string;
  kind: "booking" | "review" | "notification";
  title: string;
  detail: string;
  created: string;
};

export type CustomerOverview = {
  stats: CustomerStats;
  nextBooking: BookingRow | null;
  recentBookings: BookingRow[];
  favorites: Favorite[];
  notifications: Notification[];
  activity: CustomerActivity[];
};

export type PortfolioItem = {
  id: string;
  url: string;
  note: string;
};

export type Promotion = {
  id: string;
  name: string;
  kind: string;
  amount: number;
  start: string;
  end: string;
  uses: number;
  limit: number;
  note: string;
  active: boolean;
};

/* ---------------------------------------------------------------- helpers */

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

async function listRows(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

async function getRow(table: string, id: string): Promise<Row | null> {
  try {
    return await adminDb().getDocument({
      databaseId: databaseId(),
      collectionId: table,
      documentId: id,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

function newestFirst(a: Row, b: Row): number {
  return a.$createdAt < b.$createdAt ? 1 : a.$createdAt > b.$createdAt ? -1 : 0;
}

function toNotification(row: Row): Notification {
  return {
    id: row.$id,
    title: str(row.title, "Update"),
    body: str(row.body),
    kind: str(row.kind, "info"),
    state: str(row.state) === "read" ? "read" : "unread",
    created: row.$createdAt,
  };
}

function toFavorite(barberId: string, barber: {
  id: string;
  name: string;
  title: string;
  photo: string;
  rating: number;
  shop: string;
  address: string;
  city: string;
}): Favorite {
  return {
    id: barberId,
    barber: barber.id,
    name: barber.name,
    title: barber.title,
    photo: barber.photo,
    rating: barber.rating,
    shop: barber.shop,
    address: barber.address,
    city: barber.city,
  };
}

/* --------------------------------------------------------------- favorites */

export async function listFavorites(userId: string): Promise<Favorite[]> {
  const rows = await listRows(FAVORITES, [
    Query.equal("user", userId),
    Query.limit(50),
  ]);
  if (rows.length === 0) return [];

  const barbers = await getMany(
    TABLES.barbers,
    rows.map((row) => str(row.barber)),
  );
  const byId = new Map(barbers.map((row) => [row.$id, row]));

  const result: Favorite[] = [];
  for (const row of rows) {
    const barber = byId.get(str(row.barber));
    if (!barber) continue;
    result.push(
      toFavorite(str(row.barber), {
        id: barber.$id,
        name: str(barber.name),
        title: str(barber.title),
        photo: str(barber.photo),
        rating: num(barber.rating),
        shop: str(barber.shop),
        address: str(barber.address),
        city: str(barber.city, "Tashkent"),
      }),
    );
  }
  return result;
}

export async function isFavorite(
  userId: string,
  barberId: string,
): Promise<boolean> {
  const rows = await listRows(FAVORITES, [
    Query.equal("user", userId),
    Query.equal("barber", barberId),
    Query.limit(1),
  ]);
  return rows.length > 0;
}

async function favoriteFor(barberId: string): Promise<Favorite | null> {
  const barber = await getBarber(barberId);
  if (!barber || !barber.active) return null;
  return toFavorite(barberId, barber);
}

export async function addFavorite(
  userId: string,
  barberId: string,
): Promise<Favorite | null> {
  const barber = await getBarber(barberId);
  if (!barber || !barber.active) return null;

  try {
    await adminDb().createDocument({
      databaseId: databaseId(),
      collectionId: FAVORITES,
      documentId: ID.unique(),
      data: { user: userId, barber: barberId },
    });
  } catch (error) {
    // A parallel request may have created the same unique pair.
    if (!(error instanceof AppwriteException && error.code === 409)) throw error;
  }

  return favoriteFor(barberId);
}

export async function removeFavorite(
  userId: string,
  barberId: string,
): Promise<void> {
  const rows = await listRows(FAVORITES, [
    Query.equal("user", userId),
    Query.equal("barber", barberId),
    Query.limit(100),
  ]);
  await Promise.all(
    rows.map((row) =>
      adminDb().deleteDocument({
        databaseId: databaseId(),
        collectionId: FAVORITES,
        documentId: row.$id,
      }),
    ),
  );
}

export async function toggleFavorite(
  userId: string,
  barberId: string,
): Promise<{ saved: boolean; favorite: Favorite | null }> {
  const rows = await listRows(FAVORITES, [
    Query.equal("user", userId),
    Query.equal("barber", barberId),
    Query.limit(100),
  ]);

  if (rows.length > 0) {
    await Promise.all(
      rows.map((row) =>
        adminDb().deleteDocument({
          databaseId: databaseId(),
          collectionId: FAVORITES,
          documentId: row.$id,
        }),
      ),
    );
    return { saved: false, favorite: null };
  }

  return { saved: true, favorite: await addFavorite(userId, barberId) };
}

/* ------------------------------------------------------------ notifications */

export async function notificationInbox(
  userId: string,
  limit = 20,
): Promise<{ notifications: Notification[]; unread: number }> {
  const rows = await listRows(NOTIFICATIONS, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);
  const all = rows.sort(newestFirst).map(toNotification);

  return {
    notifications: all.slice(0, Math.min(Math.max(limit, 1), 50)),
    unread: all.filter((item) => item.state === "unread").length,
  };
}

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  return (await notificationInbox(userId, limit)).notifications;
}

export async function createNotification(input: {
  user: string;
  title: string;
  body: string;
  kind?: string;
}): Promise<Notification> {
  const row = await adminDb().createDocument({
    databaseId: databaseId(),
    collectionId: NOTIFICATIONS,
    documentId: ID.unique(),
    data: {
      user: input.user,
      title: input.title.slice(0, 96),
      body: input.body.slice(0, 512),
      kind: (input.kind ?? "info").slice(0, 24),
      state: "new",
    },
  });
  return toNotification(row as Row);
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await getRow(NOTIFICATIONS, id);
  if (!row || str(row.user) !== userId) return false;
  if (str(row.state) === "read") return true;

  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: NOTIFICATIONS,
    documentId: id,
    data: { state: "read" },
  });
  return true;
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const rows = await listRows(NOTIFICATIONS, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);
  const unread = rows.filter((row) => str(row.state) !== "read");

  await Promise.all(
    unread.map((row) =>
      adminDb().updateDocument({
        databaseId: databaseId(),
        collectionId: NOTIFICATIONS,
        documentId: row.$id,
        data: { state: "read" },
      }),
    ),
  );
  return unread.length;
}

/* ----------------------------------------------------------------- settings */

const PREF_DEFAULTS: NotifyPrefs = {
  bookings: true,
  reminders: true,
  offers: false,
};

function toPrefs(prefs: Models.Preferences): NotifyPrefs {
  const raw = (prefs ?? {}) as Record<string, unknown>;
  const flag = (key: keyof NotifyPrefs) =>
    typeof raw[key] === "boolean" ? raw[key] : PREF_DEFAULTS[key];

  return {
    bookings: flag("bookings"),
    reminders: flag("reminders"),
    offers: flag("offers"),
  };
}

export async function getSettings(userId: string): Promise<SettingsData> {
  const users = new Users(createAdminClient());
  const [profile, user] = await Promise.all([
    getProfile(userId),
    users.get({ userId }),
  ]);

  return {
    profile:
      profile ??
      {
        id: userId,
        name: user.name || "Member",
        phone: "",
        role: "client",
        avatar: "",
      },
    prefs: toPrefs(user.prefs),
  };
}

export async function updateSettings(
  userId: string,
  input: {
    name?: string;
    phone?: string;
    avatar?: string;
    prefs?: Partial<NotifyPrefs>;
  },
): Promise<SettingsData> {
  const users = new Users(createAdminClient());
  const patch: Record<string, unknown> = {};
  if (typeof input.name === "string") patch.name = input.name;
  if (typeof input.phone === "string") patch.phone = input.phone;
  if (typeof input.avatar === "string") patch.avatar = input.avatar;

  if (Object.keys(patch).length > 0) {
    await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: TABLES.users,
      documentId: userId,
      data: patch,
    });
  }

  if (input.name) {
    await users
      .updateName({ userId, name: input.name })
      .catch((error) => console.error("[customer] could not sync auth name", error));
  }

  if (input.prefs) {
    const user = await users.get({ userId });
    const current = toPrefs(user.prefs);
    await users.updatePrefs({
      userId,
      prefs: {
        ...user.prefs,
        bookings: input.prefs.bookings ?? current.bookings,
        reminders: input.prefs.reminders ?? current.reminders,
        offers: input.prefs.offers ?? current.offers,
      },
    });
  }

  return getSettings(userId);
}

/* ----------------------------------------------------------------- overview */

const UPCOMING = ["pending", "accepted", "booked"];
const PAST = ["cancel", "noshow", "rejected"];

export async function customerOverview(
  userId: string,
): Promise<CustomerOverview> {
  const [bookings, favorites, inbox, reviews] = await Promise.all([
    myBookings(userId),
    listFavorites(userId),
    notificationInbox(userId, 5),
    listReviewsByUser(userId),
  ]);

  const date = today();
  const upcoming = bookings.filter(
    (booking) =>
      UPCOMING.includes(booking.status) && booking.date >= date,
  );
  const recentBookings = [...bookings]
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, 3);

  const activity: CustomerActivity[] = [
    ...recentBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      kind: "booking" as const,
      title: booking.serviceName,
      detail: `${booking.barberName} · ${STATUS_LABEL[booking.status]}`,
      created: booking.created,
    })),
    ...reviews.slice(0, 3).map((review) => ({
      id: `review-${review.id}`,
      kind: "review" as const,
      title: "Review posted",
      detail: `You rated your visit ${review.rate} out of 5.`,
      created: review.created,
    })),
    ...inbox.notifications.slice(0, 3).map((item) => ({
      id: `notification-${item.id}`,
      kind: "notification" as const,
      title: item.title,
      detail: item.body,
      created: item.created,
    })),
  ]
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, 6);

  return {
    stats: {
      upcoming: upcoming.length,
      completed: bookings.filter((booking) => booking.status === "done").length,
      cancelled: bookings.filter((booking) => PAST.includes(booking.status)).length,
      favorites: favorites.length,
      reviews: reviews.length,
      unread: inbox.unread,
    },
    nextBooking: upcoming[0] ?? null,
    recentBookings,
    favorites,
    notifications: inbox.notifications,
    activity,
  };
}

/* --------------------------------------------------- public profile extras */

export async function listPortfolio(barberId: string): Promise<PortfolioItem[]> {
  const rows = await listRows(PORTFOLIO, [
    Query.equal("barber", barberId),
    Query.limit(30),
  ]);
  return rows.map((row) => ({
    id: row.$id,
    url: str(row.url),
    note: str(row.note),
  }));
}

export async function listPromotions(barberId: string): Promise<Promotion[]> {
  const date = today();
  const rows = await listRows(PROMOTIONS, [
    Query.equal("barber", barberId),
    Query.limit(30),
  ]);

  return rows
    .map((row) => ({
      id: row.$id,
      name: str(row.name, "Offer"),
      kind: str(row.kind, "percent"),
      amount: num(row.amount),
      start: str(row.start),
      end: str(row.end),
      uses: num(row.uses),
      limit: num(row.limit),
      note: str(row.note),
      active: bool(row.active, true),
    }))
    .filter(
      (item) =>
        item.active &&
        (!item.start || item.start <= date) &&
        (!item.end || date <= item.end) &&
        (item.limit === 0 || item.uses < item.limit),
    );
}
