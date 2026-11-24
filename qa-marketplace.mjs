/**
 * Marketplace probe: favorites, inbox, settings, messaging, payments and
 * barber business APIs. Requires a dev server and database scopes.
 *
 *   node qa-marketplace.mjs
 */
import fs from "node:fs";
import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const BASE = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const databaseId = env.APPWRITE_DATABASE_ID;
const admin = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);
const account = new Account(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
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
      ...(body ? { "content-type": "application/json", origin: BASE } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    json: await response.json().catch(() => null),
  };
}

async function signIn(label) {
  const email = `icone.qa.${label}.${Date.now()}@mailinator.com`;
  const start = await fetch(`${BASE}/api/auth/email/start`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email }),
  });
  const otp = cookieValue(start.headers.getSetCookie(), "icone_otp");
  const token = await account.createEmailToken({ userId: otp, email });
  const verify = await fetch(`${BASE}/api/auth/email/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: `icone_otp=${otp}`,
    },
    body: JSON.stringify({ code: token.secret }),
  });
  return {
    id: otp,
    email,
    secret: cookieValue(verify.headers.getSetCookie(), "icone_session"),
  };
}

const ids = {
  users: [],
  profiles: [],
  chair: "",
  hour: "",
  booking: "",
  favorite: "",
  notification: "",
  promotion: "",
  portfolio: "",
  messages: [],
};

async function cleanup() {
  for (const id of ids.messages) {
    await db.deleteDocument({ databaseId, collectionId: "messages", documentId: id }).catch(() => {});
  }
  if (ids.portfolio) {
    await db.deleteDocument({ databaseId, collectionId: "portfolio", documentId: ids.portfolio }).catch(() => {});
  }
  if (ids.promotion) {
    await db.deleteDocument({ databaseId, collectionId: "promotions", documentId: ids.promotion }).catch(() => {});
  }
  if (ids.notification) {
    await db.deleteDocument({ databaseId, collectionId: "notifications", documentId: ids.notification }).catch(() => {});
  }
  if (ids.favorite) {
    await db.deleteDocument({ databaseId, collectionId: "favorites", documentId: ids.favorite }).catch(() => {});
  }
  // Payments are owned by the booking; delete by query.
  const payments = await db.listDocuments({
    databaseId,
    collectionId: "payments",
    queries: [Query.equal("booking", ids.booking || "none")],
  }).catch(() => ({ documents: [] }));
  for (const row of payments.documents) {
    await db.deleteDocument({ databaseId, collectionId: "payments", documentId: row.$id }).catch(() => {});
  }
  if (ids.booking) {
    await db.deleteDocument({ databaseId, collectionId: "bookings", documentId: ids.booking }).catch(() => {});
  }
  if (ids.hour) {
    await db.deleteDocument({ databaseId, collectionId: "hours", documentId: ids.hour }).catch(() => {});
  }
  if (ids.chair) {
    await db.deleteDocument({ databaseId, collectionId: "barbers", documentId: ids.chair }).catch(() => {});
  }
  for (const id of ids.profiles) {
    await db.deleteDocument({ databaseId, collectionId: "users", documentId: id }).catch(() => {});
  }
  for (const id of ids.users) {
    await users.delete({ userId: id }).catch(() => {});
  }
}

async function main() {
  const customer = await signIn("cust");
  const barber = await signIn("barb");
  const outsider = await signIn("out");
  ids.users.push(customer.id, barber.id, outsider.id);
  ids.profiles.push(customer.id, barber.id, outsider.id);
  check("three QA sessions created", Boolean(customer.secret && barber.secret && outsider.secret));

  // Link the barber account to a chair and give it the barber role.
  ids.chair = ID.unique();
  await db.createDocument({
    databaseId,
    collectionId: "barbers",
    documentId: ids.chair,
    data: {
      name: "QA Market Barber",
      title: "Stylist",
      bio: "Probe chair",
      photo: "",
      rating: 0,
      active: true,
      user: barber.id,
      shop: "QA Chair",
      address: "12 Amir Temur Avenue",
      city: "Tashkent",
      years: 5,
      skills: "Fades",
      phone: "",
      social: "",
      facilities: "",
      policy: "",
      cover: "",
      confirm: false,
      featured: false,
    },
  });
  await db.updateDocument({
    databaseId,
    collectionId: "users",
    documentId: barber.id,
    data: { role: "barber" },
  });

  // Favorites.
  const fav = await call("/api/favorites", {
    method: "POST",
    secret: customer.secret,
    body: { barber: ids.chair },
  });
  check("POST /api/favorites", fav.status === 200 || fav.status === 201, `status ${fav.status}`);
  const favList = await call("/api/favorites", { secret: customer.secret });
  ids.favorite = favList.json?.favorites?.[0]?.id ?? fav.json?.favorite?.id ?? "";
  check("favorites list contains the chair", favList.status === 200 && favList.json.favorites.length === 1);

  // Notifications.
  const note = await db.createDocument({
    databaseId,
    collectionId: "notifications",
    documentId: ID.unique(),
    data: { user: customer.id, title: "QA notice", body: "Probe", kind: "booking", state: "new" },
  });
  ids.notification = note.$id;
  const inbox = await call("/api/notifications", { secret: customer.secret });
  check("notification inbox", inbox.status === 200 && Array.isArray(inbox.json?.notifications));
  const marked = await call("/api/notifications", {
    method: "PATCH",
    secret: customer.secret,
    body: { id: note.$id },
  });
  check("mark notification read", marked.status === 200, `status ${marked.status}`);

  // Settings.
  const settings = await call("/api/settings", {
    method: "PATCH",
    secret: customer.secret,
    body: { name: "QA Customer", phone: "+998900000000", prefs: { offers: false } },
  });
  check(
    "PATCH /api/settings",
    settings.status === 200 && settings.json?.profile?.name === "QA Customer",
    `status ${settings.status}`,
  );

  // Availability + booking -> payment.
  const date = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const hour = await db.createDocument({
    databaseId,
    collectionId: "hours",
    documentId: ID.unique(),
    data: { barber: ids.chair, day, start: 600, end: 900 },
  });
  ids.hour = hour.$id;

  const booked = await call("/api/bookings", {
    method: "POST",
    secret: customer.secret,
    body: { barber: ids.chair, service: "svc_cut", date, start: 600, note: "QA marketplace" },
  });
  ids.booking = booked.json?.booking?.id ?? "";
  check("booking created", booked.status === 201 && Boolean(ids.booking), `status ${booked.status}`);

  const payment = await call(`/api/payments?booking=${ids.booking}`, { secret: customer.secret });
  check("payment starts pending at shop", payment.status === 200 && payment.json?.payment?.status === "pending" && payment.json?.payment?.method === "shop");

  const paid = await call("/api/payments", {
    method: "PATCH",
    secret: barber.secret,
    body: { booking: ids.booking, status: "paid", method: "card" },
  });
  check("barber can mark payment paid", paid.status === 200 && paid.json?.payment?.status === "paid", `status ${paid.status}`);

  const paidView = await call(`/api/payments?booking=${ids.booking}`, { secret: customer.secret });
  check("customer sees paid status", paidView.json?.payment?.status === "paid");

  // Messaging.
  const sent = await call("/api/messages", {
    method: "POST",
    secret: customer.secret,
    body: { to: barber.id, body: "Hello from QA" },
  });
  ids.messages.push(sent.json?.message?.id ?? "");
  check("customer messages barber", sent.status === 201, `status ${sent.status}`);
  check("message is scoped to booking relationship", sent.status === 201);

  const thread = await call(`/api/messages?with=${barber.id}`, { secret: customer.secret });
  check("thread history available to customer", thread.status === 200 && thread.json?.messages?.length === 1);

  const reply = await call("/api/messages", {
    method: "POST",
    secret: barber.secret,
    body: { to: customer.id, body: "Hello back" },
  });
  ids.messages.push(reply.json?.message?.id ?? "");
  check("barber can reply", reply.status === 201, `status ${reply.status}`);

  const forbidden = await call(`/api/messages?with=${barber.id}`, { secret: outsider.secret });
  check("outsider cannot read the thread", forbidden.status === 403, `status ${forbidden.status}`);

  // Barber business APIs.
  const promo = await call("/api/barber/promotions", {
    method: "POST",
    secret: barber.secret,
    body: {
      name: "QA Offer",
      kind: "percent",
      amount: 10,
      start: "",
      end: "",
      limit: 5,
      note: "Probe",
      active: true,
      uses: 0,
    },
  });
  ids.promotion = promo.json?.promotion?.id ?? "";
  check(
    "barber creates a promotion",
    (promo.status === 200 || promo.status === 201) && Boolean(ids.promotion),
    `status ${promo.status}`,
  );

  const portfolio = await call("/api/barber/portfolio", {
    method: "POST",
    secret: barber.secret,
    body: { url: "https://example.com/cut.jpg", note: "QA cut" },
  });
  ids.portfolio = portfolio.json?.item?.id ?? portfolio.json?.portfolio?.id ?? "";
  check(
    "barber adds portfolio item",
    portfolio.status === 200 || portfolio.status === 201,
    `status ${portfolio.status}`,
  );

  const barberPromos = await call("/api/barber/promotions", { secret: barber.secret });
  check("promotion appears in barber list", barberPromos.status === 200 && barberPromos.json.promotions.some((p) => p.id === ids.promotion));

  // Pages render for the right roles.
  for (const [path, secret] of [
    ["/customer", customer.secret],
    ["/favorites", customer.secret],
    ["/notifications", customer.secret],
    ["/settings", customer.secret],
    ["/messages", customer.secret],
    ["/barber", barber.secret],
  ]) {
    const res = await call(path, { secret });
    check(`${path} renders`, res.status === 200, `status ${res.status}`);
  }

  const clientForbidden = await call("/api/barber/promotions", { secret: customer.secret });
  check("client cannot access barber APIs", clientForbidden.status === 403, `status ${clientForbidden.status}`);
}

try {
  await main();
} finally {
  await cleanup();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
