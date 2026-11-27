import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";
import { serverEnv } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram/notify";

import { getProfiles } from "./account";
import { create, first, list, str, update, type Row } from "./crud";
import { formatPhone } from "./directory";
import { label } from "./time";
import type { Locale, Notification, NotificationPrefs } from "./types";

/**
 * Notifications: an in-app inbox row plus an optional Telegram message.
 *
 * Copy lives here, in all three languages, so no route handler ever builds a
 * sentence by hand. Telegram is only used when the member has not turned the
 * category off, and the message never carries anything a stranger could use.
 */

export type NotifyKey =
  | "booked"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "rescheduled"
  | "reminder"
  | "waitlist"
  | "application.approved"
  | "application.rejected"
  | "application.info"
  | "invite"
  | "team.joined"
  | "message"
  | "welcome";

type Params = Record<string, string | number>;

type Copy = { title: string; body: string };

/** Which preference category each notification belongs to. */
const PREF_OF: Record<NotifyKey, keyof NotificationPrefs> = {
  booked: "booking",
  confirmed: "booking",
  rejected: "booking",
  cancelled: "booking",
  rescheduled: "booking",
  reminder: "reminder",
  waitlist: "waitlist",
  "application.approved": "business",
  "application.rejected": "business",
  "application.info": "business",
  invite: "business",
  "team.joined": "business",
  message: "booking",
  welcome: "booking",
};

function fill(template: string, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : "",
  );
}

const TEMPLATES: Record<Locale, Record<NotifyKey, Copy>> = {
  uz: {
    booked: {
      title: "So'rov yuborildi",
      body: "{date} kuni {time} da {barber} uchun so'rovingiz yuborildi.",
    },
    confirmed: {
      title: "Tasdiqlandi",
      body: "{date} kuni {time} da uchrashuvingiz tasdiqlandi.",
    },
    rejected: {
      title: "Rad etildi",
      body: "{date} kuni {time} da so'rov rad etildi. Boshqa vaqt tanlang.",
    },
    cancelled: {
      title: "Bekor qilindi",
      body: "{date} kuni {time} da uchrashuv bekor qilindi.",
    },
    rescheduled: {
      title: "Vaqt o'zgartirildi",
      body: "Uchrashuvingiz {date} kuni {time} ga ko'chirildi.",
    },
    reminder: {
      title: "Eslatma",
      body: "{barber} bilan uchrashuvingiz ertaga {time} da.",
    },
    waitlist: {
      title: "Bo'sh vaqt ochildi",
      body: "Tanlagan vaqtingiz bo'sh. Hoziroq band qiling.",
    },
    "application.approved": {
      title: "Ariza tasdiqlandi",
      body: "Profilingiz tayyor. Ishni boshlang.",
    },
    "application.rejected": {
      title: "Ariza rad etildi",
      body: "{reason}",
    },
    "application.info": {
      title: "Qo'shimcha ma'lumot kerak",
      body: "{note}",
    },
    invite: {
      title: "Jamoa taklifi",
      body: "{business} sizni {role} sifatida taklif qildi.",
    },
    "team.joined": {
      title: "Jamoga qo'shildingiz",
      body: "{business} jamoasiga qo'shildingiz.",
    },
    message: {
      title: "Yangi xabar",
      body: "Sizga yangi xabar kelib tushdi.",
    },
    welcome: {
      title: "Xush kelibsiz",
      body: "Ismingizni, xizmatlaringizni kiriting va birinchi mijozlarni qabul qiling.",
    },
  },

  ru: {
    booked: {
      title: "Заявка отправлена",
      body: "Ваша заявка на {date} в {time} к {barber} отправлена.",
    },
    confirmed: {
      title: "Подтверждено",
      body: "Ваша встреча {date} в {time} подтверждена.",
    },
    rejected: {
      title: "Отклонено",
      body: "Заявка на {date} в {time} отклонена. Выберите другое время.",
    },
    cancelled: {
      title: "Отменено",
      body: "Встреча {date} в {time} отменена.",
    },
    rescheduled: {
      title: "Время изменено",
      body: "Встреча перенесена на {date}, {time}.",
    },
    reminder: {
      title: "Напоминание",
      body: "Ваша встреча с {barber} завтра в {time}.",
    },
    waitlist: {
      title: "Свободное время",
      body: "Желаемое время освободилось. Запишитесь.",
    },
    "application.approved": {
      title: "Заявка одобрена",
      body: "Профиль готов. Можно начинать.",
    },
    "application.rejected": {
      title: "Заявка отклонена",
      body: "{reason}",
    },
    "application.info": {
      title: "Нужны дополнительные данные",
      body: "{note}",
    },
    invite: {
      title: "Приглашение в команду",
      body: "{business} приглашает вас как {role}.",
    },
    "team.joined": {
      title: "Вы в команде",
      body: "Вы присоединились к команде {business}.",
    },
    message: {
      title: "Новое сообщение",
      body: "Вам пришло новое сообщение.",
    },
    welcome: {
      title: "Добро пожаловать",
      body: "Заполните профиль, услуги и принимайте первых клиентов.",
    },
  },

  en: {
    booked: {
      title: "Request sent",
      body: "Your request with {barber} on {date} at {time} is awaiting approval.",
    },
    confirmed: {
      title: "Confirmed",
      body: "Your appointment on {date} at {time} is confirmed.",
    },
    rejected: {
      title: "Declined",
      body: "The request on {date} at {time} was declined. Pick another time.",
    },
    cancelled: {
      title: "Cancelled",
      body: "The appointment on {date} at {time} was cancelled.",
    },
    rescheduled: {
      title: "Time changed",
      body: "Your appointment moved to {date} at {time}.",
    },
    reminder: {
      title: "Reminder",
      body: "Your appointment with {barber} is tomorrow at {time}.",
    },
    waitlist: {
      title: "A slot opened up",
      body: "The time you wanted is free. Book it now.",
    },
    "application.approved": {
      title: "Application approved",
      body: "Your profile is ready. You can start taking bookings.",
    },
    "application.rejected": {
      title: "Application declined",
      body: "{reason}",
    },
    "application.info": {
      title: "More information needed",
      body: "{note}",
    },
    invite: {
      title: "Team invitation",
      body: "{business} invited you as {role}.",
    },
    "team.joined": {
      title: "You joined the team",
      body: "You are now part of {business}.",
    },
    message: {
      title: "New message",
      body: "You have a new message.",
    },
    welcome: {
      title: "Welcome",
      body: "Add your profile and services, then take your first bookings.",
    },
  },
};

const FALLBACK: Locale = "uz";

/* -------------------------------------------------------------- in-app */

export function toNotification(row: Row): Notification {
  return {
    id: row.$id,
    user: str(row.user),
    title: str(row.title),
    body: str(row.body),
    kind: str(row.kind, "info"),
    state: str(row.state, "new") === "read" ? "read" : "new",
    link: str(row.link),
    created: row.$createdAt,
  };
}

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  const queries = [Query.equal("user", userId)];
  if (options.unreadOnly) queries.push(Query.equal("state", "new"));

  const rows = await list(TABLES.notifications, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(options.limit ?? 50),
  ]);
  return rows.map(toNotification);
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await list(TABLES.notifications, [
    Query.equal("user", userId),
    Query.equal("state", "new"),
    Query.limit(100),
  ]);
  return rows.length;
}

export async function markRead(userId: string, id?: string): Promise<void> {
  if (id) {
    // Ownership belongs in the domain, not only in the calling route.
    const row = await first(TABLES.notifications, [
      Query.equal("$id", id),
      Query.equal("user", userId),
    ]);
    if (!row) return;
    await update(TABLES.notifications, id, { state: "read" });
    return;
  }
  const rows = await list(TABLES.notifications, [
    Query.equal("user", userId),
    Query.equal("state", "new"),
    Query.limit(100),
  ]);
  await Promise.all(
    rows.map((row) => update(TABLES.notifications, row.$id, { state: "read" })),
  );
}

/* -------------------------------------------------------------- telegram */

/** Send to one Telegram chat. Failures are logged, never thrown at a page. */
export async function telegram(
  chatId: number,
  text: string,
  link?: string,
): Promise<boolean> {
  if (!Number.isSafeInteger(chatId) || chatId <= 0) return false;

  try {
    const env = serverEnv();
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, link);
    return true;
  } catch (error) {
    console.error("[notify] telegram failed", error);
    return false;
  }
}

/** The Telegram chat id behind a `tg_<id>` account, or null. */
export function chatOf(userId: string): number | null {
  if (!userId.startsWith("tg_")) return null;
  const chatId = Number(userId.slice(3));
  return Number.isSafeInteger(chatId) && chatId > 0 ? chatId : null;
}

/* ------------------------------------------------------------------ send */

export type NotifyInput = {
  userId: string;
  key: NotifyKey;
  params?: Params;
  /** Path inside the app, e.g. "/bookings/abc". */
  link?: string;
  /** Force a category on regardless of preferences (critical messages). */
  force?: boolean;
};

/**
 * Deliver one notification to one account.
 *
 * Returns true when something was actually stored or sent, so callers can
 * decide whether a failure matters to them.
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  const params = input.params ?? {};
  const profiles = await getProfiles([input.userId]);
  const profile = profiles.get(input.userId);
  const locale: Locale = profile?.locale ?? FALLBACK;

  const copy = TEMPLATES[locale]?.[input.key] ?? TEMPLATES[FALLBACK][input.key];
  const title = fill(copy.title, params);
  const body = fill(copy.body, params);

  const prefs: NotificationPrefs = profile?.prefs ?? {
    booking: true,
    reminder: true,
    waitlist: true,
    business: true,
    marketing: false,
  };

  const allowed = input.force || prefs[PREF_OF[input.key]];

  let stored = false;
  try {
    await create(TABLES.notifications, {
      user: input.userId,
      title: title.slice(0, 96),
      body: body.slice(0, 512),
      kind: PREF_OF[input.key],
      state: "new",
      link: (input.link ?? "").slice(0, 256),
    });
    stored = true;
  } catch (error) {
    console.error("[notify] inbox write failed", error);
  }

  if (!allowed) return stored;

  const chatId = chatOf(input.userId);
  if (chatId === null) return stored;

  const sent = await telegram(chatId, `${title}\n${body}`, absolute(input.link));
  return stored || sent;
}

/** Build an absolute URL for the button under a Telegram message. */
function absolute(path?: string): string | undefined {
  if (!path) return undefined;
  const base = serverEnv().NEXT_PUBLIC_APP_URL;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Deliver the same notification to several accounts. */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<number> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const results = await Promise.all(
    unique.map((userId) => notify({ ...input, userId })),
  );
  return results.filter(Boolean).length;
}

/** Everyone who should hear about something happening in a business. */
export async function businessAudience(
  businessId: string,
  roles: Array<"owner" | "manager" | "reception" | "barber"> = [
    "owner",
    "manager",
  ],
): Promise<string[]> {
  const rows = await list(TABLES.memberships, [
    Query.equal("business", businessId),
    Query.equal("state", "active"),
    Query.limit(100),
  ]);

  return rows
    .filter((row) => roles.includes(str(row.role) as (typeof roles)[number]))
    .map((row) => str(row.user))
    .filter(Boolean);
}

/* --------------------------------------------------------------- helpers */

/** Standard params for an appointment-shaped notification. */
export function appointmentParams(input: {
  date: string;
  start: number;
  barber: string;
}): Params {
  return {
    date: input.date,
    time: label(input.start),
    barber: input.barber,
  };
}

/** Phone numbers are only ever shown to the people who need them. */
export function contactLine(phone: string): string {
  return phone ? formatPhone(phone) : "";
}
