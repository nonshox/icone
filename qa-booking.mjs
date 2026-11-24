/**
 * End-to-end booking probe. Requires a running dev server, a filled
 * `.env.local` and an API key with database scopes (see docs/DATA.md).
 *
 *   node qa-booking.mjs
 *
 * Creates throwaway users, bookings and reviews, then deletes them again.
 */
import fs from "node:fs";
import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
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

const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function cookieValue(cookies, name) {
  for (const item of cookies ?? []) {
    const [pair] = item.split(";");
    const [key, ...rest] = pair.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

async function call(path, { method = "GET", body, secret } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(secret ? { cookie: `icone_session=${secret}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const email = `icone.qa.${Date.now()}@mailinator.com`;
let userId = "";
let secret = "";
const bookingIds = [];
let reviewId = "";

async function cleanup() {
  if (reviewId) {
    await db.deleteDocument({ databaseId, collectionId: "reviews", documentId: reviewId }).catch(() => {});
  }
  for (const id of bookingIds) {
    await db.deleteDocument({ databaseId, collectionId: "bookings", documentId: id }).catch(() => {});
  }
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
          "then run `npm run db:setup` and `node qa-booking.mjs` again.",
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

  // Sign in through the real OTP endpoint so the profile row is created too.
  const start = await fetch(`${BASE}/api/auth/email/start`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email }),
  });
  const otpCookie = cookieValue(start.headers.getSetCookie(), "icone_otp");
  if (!otpCookie) throw new Error("QA email start did not set the OTP cookie");

  const token = await new Account(admin).createEmailToken({
    userId: otpCookie,
    email,
  });

  const verify = await fetch(`${BASE}/api/auth/email/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: `icone_otp=${otpCookie}`,
    },
    body: JSON.stringify({ code: token.secret }),
  });
  userId = otpCookie;
  secret = cookieValue(verify.headers.getSetCookie(), "icone_session");
  if (!secret) throw new Error("QA email verify did not set the session cookie");

  const barbers = await call("/api/barbers");
  const services = await call("/api/services");
  check("GET /api/barbers", barbers.status === 200 && barbers.json?.barbers?.length > 0);
  check("GET /api/services", services.status === 200 && services.json?.services?.length > 0);
  if (!barbers.json?.barbers?.length || !services.json?.services?.length) return;

  const barber = barbers.json.barbers[0];
  const service = services.json.services[0];

  let date = "";
  let slot = null;
  const today = new Date().toISOString().slice(0, 10);
  for (let offset = 2; offset <= 9 && !slot; offset += 1) {
    const candidate = addDays(today, offset);
    const res = await call(
      `/api/availability?barber=${barber.id}&date=${candidate}&service=${service.id}`,
    );
    if (res.status === 200 && res.json?.slots?.length > 0) {
      date = candidate;
      slot = res.json.slots[0];
    }
  }
  check("GET /api/availability returns a slot", Boolean(slot), date);

  const detail = await call(`/api/barbers/${barber.id}`);
  check("GET /api/barbers/:id", detail.status === 200 && Array.isArray(detail.json?.hours));

  const menuDetail = await call(`/api/services/${service.id}`);
  check("GET /api/services/:id", menuDetail.status === 200 && menuDetail.json?.service?.id === service.id);

  const bookingInput = {
    barber: barber.id,
    service: service.id,
    date,
    start: slot.start,
    note: "QA booking",
  };

  const first = await call("/api/bookings", { method: "POST", body: bookingInput, secret });
  check("POST /api/bookings", first.status === 201, `status ${first.status}`);
  if (first.json?.booking?.id) bookingIds.push(first.json.booking.id);
  check("booking has price + names",
    first.json?.booking?.price === service.price &&
      first.json?.booking?.barberName === barber.name,
  );

  const mine = await call("/api/bookings", { secret });
  check("GET /api/bookings contains the booking",
    mine.status === 200 &&
      mine.json.bookings.some((row) => row.id === first.json?.booking?.id),
  );

  const byId = await call(`/api/bookings/${first.json?.booking?.id}`, { secret });
  check("GET /api/bookings/:id", byId.status === 200 && byId.json?.booking?.status === "booked");

  const clash = await call("/api/bookings", { method: "POST", body: bookingInput, secret });
  check("overlapping booking rejected", clash.status === 409, `code ${clash.json?.error?.code}`);

  const cancelled = await call(`/api/bookings/${first.json?.booking?.id}`, {
    method: "PATCH",
    body: { status: "cancel" },
    secret,
  });
  check("member can cancel", cancelled.status === 200 && cancelled.json?.booking?.status === "cancel");

  const again = await call("/api/bookings", { method: "POST", body: bookingInput, secret });
  check("cancelled slot is free again", again.status === 201, `status ${again.status}`);
  if (again.json?.booking?.id) bookingIds.push(again.json.booking.id);

  await db.updateDocument({
    databaseId,
    collectionId: "users",
    documentId: userId,
    data: { role: "admin" },
  });

  const agenda = await call(`/api/bookings?date=${date}`, { secret });
  check("staff agenda reads the day",
    agenda.status === 200 &&
      agenda.json.bookings.some((row) => row.id === again.json?.booking?.id),
  );

  const done = await call(`/api/bookings/${again.json?.booking?.id}`, {
    method: "PATCH",
    body: { status: "done" },
    secret,
  });
  check("staff can complete a visit", done.status === 200 && done.json?.booking?.status === "done");

  const review = await call("/api/reviews", {
    method: "POST",
    body: { booking: again.json.booking.id, rate: 5, note: "QA review" },
    secret,
  });
  check("POST /api/reviews", review.status === 201, `status ${review.status}`);
  if (review.json?.review?.id) reviewId = review.json.review.id;

  const duplicate = await call("/api/reviews", {
    method: "POST",
    body: { booking: again.json.booking.id, rate: 4 },
    secret,
  });
  check("duplicate review rejected", duplicate.status === 409, `code ${duplicate.json?.error?.code}`);

  const publicReviews = await call(`/api/reviews?barber=${barber.id}`);
  check("GET /api/reviews", publicReviews.status === 200 && publicReviews.json.reviews.length > 0);

  const updatedMine = await call("/api/bookings", { secret });
  check("booking flagged as reviewed",
    updatedMine.json.bookings.some((row) => row.id === again.json?.booking?.id && row.reviewed),
  );

  const profile = await call("/api/me", { secret });
  check("GET /api/me", profile.status === 200 && profile.json?.profile?.role === "admin");

  const renamed = await call("/api/me", {
    method: "PATCH",
    body: { name: "QA Renamed", phone: "+998900000000" },
    secret,
  });
  check("PATCH /api/me", renamed.status === 200 && renamed.json?.profile?.name === "QA Renamed");
}

try {
  await main();
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
