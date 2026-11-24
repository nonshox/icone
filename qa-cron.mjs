/**
 * End-to-end reminders cron probe. Requires a running dev server and a
 * filled `.env` whose API key has database scopes (see docs/DATA.md).
 *
 *   node qa-cron.mjs
 *
 * Exercises the shared-secret guard, the counts envelope and the cooldown,
 * then removes any reminder rows (and the throwaway user/booking) it created.
 */
import fs from "node:fs";
import { Client, Databases, ID, Query, Users } from "node-appwrite";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const BASE = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const endpoint = env.APPWRITE_ENDPOINT;
const project = env.APPWRITE_PROJECT_ID;
const databaseId = env.APPWRITE_DATABASE_ID;
const cronSecret = env.TELEGRAM_WEBHOOK_SECRET;

const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition), extra });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

// Shop dates use Asia/Tashkent; reproduce that here so "tomorrow" matches the
// date the cron route scans.
function tashkentToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function callCron(secret) {
  const response = await fetch(`${BASE}/api/cron/reminders`, {
    method: "POST",
    redirect: "manual",
    headers: { "x-cron-secret": secret },
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

let userId = "";
let bookingId = "";

async function myReminders() {
  if (!userId) return [];
  const result = await db.listDocuments({
    databaseId,
    collectionId: "reminders",
    queries: [Query.equal("user", userId), Query.limit(100)],
  });
  return result.documents;
}

async function cleanup() {
  for (const row of await myReminders().catch(() => [])) {
    await db
      .deleteDocument({ databaseId, collectionId: "reminders", documentId: row.$id })
      .catch(() => {});
  }
  if (bookingId) await db.deleteDocument({ databaseId, collectionId: "bookings", documentId: bookingId }).catch(() => {});
  if (userId) await db.deleteDocument({ databaseId, collectionId: "users", documentId: userId }).catch(() => {});
  if (userId) await users.delete({ userId }).catch(() => {});
}

async function main() {
  // Fail early with the same actionable message as db:setup.
  try {
    await db.listCollections({ databaseId, queries: [Query.limit(1)] });
  } catch (error) {
    if (error.code === 401) {
      console.error(
        "The API key is missing database scopes. Fix it in the Appwrite console, " +
          "then run `npm run db:setup` and `node qa-cron.mjs` again.",
      );
      process.exit(1);
    }
    throw error;
  }

  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(BASE, { redirect: "manual" });
      if (res.status < 500) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // Give the cron something to pick up: a throwaway tg_ user with a booking
  // for tomorrow. The reminder it creates is tracked and removed below.
  userId = `tg_${Date.now()}`;
  await users.create({ userId, name: "QA Cron" });

  const [barbersRes, servicesRes] = await Promise.all([
    fetch(`${BASE}/api/barbers`).then((r) => r.json()),
    fetch(`${BASE}/api/services`).then((r) => r.json()),
  ]);
  const barber = barbersRes?.barbers?.[0];
  const service = servicesRes?.services?.[0];
  if (barber && service) {
    const booking = await db.createDocument({
      databaseId,
      collectionId: "bookings",
      documentId: ID.unique(),
      data: {
        user: userId,
        barber: barber.id,
        service: service.id,
        date: addDays(tashkentToday(), 1),
        start: 600,
        end: 630,
        price: service.price ?? 0,
        status: "booked",
        note: "QA cron",
      },
    });
    bookingId = booking.$id;
  }
  check("throwaway tg_ user + tomorrow booking created", Boolean(bookingId), userId);

  const wrong = await callCron("not-the-cron-secret");
  check("wrong cron secret → 401", wrong.status === 401, `status ${wrong.status}`);

  const first = await callCron(cronSecret);
  const counts = first.json?.counts;
  const numericCounts =
    counts &&
    ["created", "sent", "skipped", "failed"].every(
      (key) => typeof counts[key] === "number",
    );
  check(
    "correct cron secret → 200 with numeric counts",
    first.status === 200 && first.json?.ok === true && numericCounts,
    `status ${first.status} ${JSON.stringify(counts ?? first.json)}`,
  );

  const second = await callCron(cronSecret);
  check(
    "second call within cooldown → cooldown:true",
    second.status === 200 && second.json?.cooldown === true,
    `status ${second.status} ${JSON.stringify(second.json?.counts ?? second.json)}`,
  );

  // Remove any reminder rows this run produced, then confirm none are left.
  for (const row of await myReminders()) {
    await db
      .deleteDocument({ databaseId, collectionId: "reminders", documentId: row.$id })
      .catch(() => {});
  }
  check("no reminder rows leaked", (await myReminders()).length === 0);
}

try {
  await main();
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
