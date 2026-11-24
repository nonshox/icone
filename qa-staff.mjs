/**
 * Barber self-service probe. Requires a running dev server and database scopes.
 *
 *   node qa-staff.mjs
 */
import { Client, Databases, ID, Users } from "node-appwrite";

import { call, env, signIn } from "./qa-telegram.mjs";

const databaseId = env.APPWRITE_DATABASE_ID;
const admin = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

let userId = "";
let secret = "";
let barberId = "";
let hourId = "";
let dayId = "";

async function cleanup() {
  if (hourId) {
    await db.deleteDocument({ databaseId, collectionId: "hours", documentId: hourId }).catch(() => {});
  }
  if (dayId) {
    await db.deleteDocument({ databaseId, collectionId: "days", documentId: dayId }).catch(() => {});
  }
  if (barberId) {
    await db.deleteDocument({ databaseId, collectionId: "barbers", documentId: barberId }).catch(() => {});
  }
  if (userId) {
    await db.deleteDocument({ databaseId, collectionId: "users", documentId: userId }).catch(() => {});
    await users.delete({ userId }).catch(() => {});
  }
}

async function main() {
  const member = await signIn("staff");
  userId = member.id;
  secret = member.secret;
  check("QA barber signed in", Boolean(secret));

  const before = await call("/api/staff/chair", { secret });
  check("client role cannot access staff chair", before.status === 403, `status ${before.status}`);

  barberId = ID.unique();
  await db.createDocument({
    databaseId,
    collectionId: "barbers",
    documentId: barberId,
    data: {
      name: "QA Barber",
      title: "Stylist",
      bio: "QA chair",
      photo: "",
      rating: 0,
      active: true,
      user: userId,
    },
  });
  await db.updateDocument({
    databaseId,
    collectionId: "users",
    documentId: userId,
    data: { role: "barber" },
  });

  const chair = await call("/api/staff/chair", { secret });
  check("barber reads own chair", chair.status === 200 && chair.json?.chair?.id === barberId);

  const edited = await call("/api/staff/chair", {
    method: "PATCH",
    secret,
    body: { title: "Senior stylist", bio: "Updated", photo: "" },
  });
  check(
    "barber edits own profile",
    edited.status === 200 && edited.json?.chair?.title === "Senior stylist",
    `status ${edited.status}`,
  );

  const hour = await call("/api/staff/hours", {
    method: "POST",
    secret,
    body: { day: 2, start: 600, end: 900 },
  });
  hourId = hour.json?.hour?.id ?? "";
  check("barber adds weekly hour", hour.status === 201 && Boolean(hourId), `status ${hour.status}`);

  const day = await call("/api/staff/days", {
    method: "POST",
    secret,
    body: {
      date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      open: true,
      start: 660,
      end: 780,
      note: "QA override",
    },
  });
  dayId = day.json?.day?.id ?? "";
  check("barber adds date override", day.status === 200 && Boolean(dayId), `status ${day.status}`);

  const full = await call("/api/staff/chair?upcoming=7", { secret });
  check(
    "chair response includes hours, days and upcoming",
    full.status === 200 &&
      Array.isArray(full.json?.hours) &&
      full.json.hours.some((row) => row.id === hourId) &&
      Array.isArray(full.json?.days) &&
      full.json.days.some((row) => row.id === dayId) &&
      Array.isArray(full.json?.upcoming),
  );

  const delHour = await call(`/api/staff/hours?id=${hourId}`, { method: "DELETE", secret });
  const delDay = await call(`/api/staff/days?id=${dayId}`, { method: "DELETE", secret });
  check("barber deletes own hour and day", delHour.status === 200 && delDay.status === 200);
  hourId = "";
  dayId = "";

  const otherHour = await db.createDocument({
    databaseId,
    collectionId: "hours",
    documentId: ID.unique(),
    data: { barber: "brb_bekzod", day: 3, start: 600, end: 900 },
  });
  const forbidden = await call(`/api/staff/hours?id=${otherHour.$id}`, {
    method: "DELETE",
    secret,
  });
  check("barber cannot delete another chair's hour", forbidden.status === 403, `status ${forbidden.status}`);
  await db
    .deleteDocument({ databaseId, collectionId: "hours", documentId: otherHour.$id })
    .catch(() => {});
}

try {
  await main();
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
