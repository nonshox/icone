/**
 * End-to-end admin catalogue probe. Requires a running dev server and a
 * filled `.env` whose API key has database scopes (see docs/DATA.md).
 *
 *   node qa-admin.mjs
 *
 * Creates a throwaway email user, promotes it to admin, exercises every admin
 * catalogue route, then deletes the barber, service, hours, day override and
 * user again.
 */
import { Client, Databases, Query, Users } from "node-appwrite";

import { BASE, call, env, signIn } from "./qa-telegram.mjs";

const databaseId = env.APPWRITE_DATABASE_ID;
const admin = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition), extra });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

let userId = "";
let secret = "";
let barberId = "";
let serviceId = "";
let hourId = "";
let dayId = "";

async function cleanup() {
  if (hourId) await db.deleteDocument({ databaseId, collectionId: "hours", documentId: hourId }).catch(() => {});
  if (dayId) await db.deleteDocument({ databaseId, collectionId: "days", documentId: dayId }).catch(() => {});
  if (barberId) await db.deleteDocument({ databaseId, collectionId: "barbers", documentId: barberId }).catch(() => {});
  if (serviceId) await db.deleteDocument({ databaseId, collectionId: "services", documentId: serviceId }).catch(() => {});
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
          "then run `npm run db:setup` and `node qa-admin.mjs` again.",
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

  const member = await signIn("admin");
  userId = member.id;
  secret = member.secret;
  check("QA admin signed in with Telegram", Boolean(secret));
  if (!secret) throw new Error("QA Telegram sign-in failed");

  // --- guards before promotion -------------------------------------------
  const anonGet = await call("/api/admin/barbers");
  check("unauthenticated admin read → 401", anonGet.status === 401, `status ${anonGet.status}`);

  const anonPost = await call("/api/admin/barbers", {
    method: "POST",
    body: { name: "QA", title: "QA", bio: "QA" },
  });
  check("unauthenticated admin write → 401", anonPost.status === 401, `status ${anonPost.status}`);

  const clientWrite = await call("/api/admin/barbers", {
    method: "POST",
    body: { name: "QA", title: "QA", bio: "QA" },
    secret,
  });
  check("client-role admin write → 403", clientWrite.status === 403, `status ${clientWrite.status}`);

  // Promote only after the client-role guard has been checked.
  await db.updateDocument({
    databaseId,
    collectionId: "users",
    documentId: userId,
    data: { role: "admin" },
  });
  const me = await call("/api/me", { secret });
  check("promoted profile has admin role", me.json?.profile?.role === "admin", `status ${me.status}`);

  const team = await call("/api/admin/users", { secret });
  check(
    "GET /api/admin/users lists the member",
    team.status === 200 &&
      Array.isArray(team.json?.users) &&
      team.json.users.some((item) => item.id === userId && item.role === "admin"),
    `status ${team.status}`,
  );

  const rolePatch = await call("/api/admin/users", {
    method: "PATCH",
    body: { userId, role: "admin" },
    secret,
  });
  check("PATCH /api/admin/users role", rolePatch.status === 200, `status ${rolePatch.status}`);

  // --- create catalogue rows ---------------------------------------------
  const newBarber = await call("/api/admin/barbers", {
    method: "POST",
    body: { name: "QA Admin Barber", title: "Probe", bio: "Created by qa-admin" },
    secret,
  });
  barberId = newBarber.json?.barber?.id ?? "";
  check("POST /api/admin/barbers", newBarber.status === 201 && Boolean(barberId), `status ${newBarber.status}`);
  if (!barberId) return;

  const newService = await call("/api/admin/services", {
    method: "POST",
    body: { name: "QA Admin Service", note: "Probe", price: 30_000, time: 30 },
    secret,
  });
  serviceId = newService.json?.service?.id ?? "";
  check("POST /api/admin/services", newService.status === 201 && Boolean(serviceId), `status ${newService.status}`);
  if (!serviceId) return;

  const editBarber = await call("/api/admin/barbers", {
    method: "PATCH",
    body: { id: barberId, title: "QA Senior", bio: "Edited by qa-admin", photo: "" },
    secret,
  });
  check(
    "PATCH /api/admin/barbers edits details",
    editBarber.status === 200 && editBarber.json?.barber?.title === "QA Senior",
    `status ${editBarber.status}`,
  );

  const editService = await call("/api/admin/services", {
    method: "PATCH",
    body: { id: serviceId, name: "QA Service Edited", price: 45_000 },
    secret,
  });
  check(
    "PATCH /api/admin/services edits details",
    editService.status === 200 &&
      editService.json?.service?.name === "QA Service Edited" &&
      editService.json?.service?.price === 45_000,
    `status ${editService.status}`,
  );

  const link = await call("/api/admin/users", {
    method: "PATCH",
    body: { userId, barber: barberId },
    secret,
  });
  check("PATCH /api/admin/users links chair", link.status === 200, `status ${link.status}`);

  // Pick a date comfortably inside the booking horizon and away from today so
  // the lead-time clamp cannot affect the window.
  const date = addDays(new Date().toISOString().slice(0, 10), 3);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();

  const beforeHour = await call(
    `/api/availability?barber=${barberId}&date=${date}&service=${serviceId}`,
  );
  check(
    "/api/availability has no slots before the hour row",
    beforeHour.status === 200 && Array.isArray(beforeHour.json?.slots) && beforeHour.json.slots.length === 0,
    `status ${beforeHour.status}`,
  );

  const newHour = await call("/api/admin/hours", {
    method: "POST",
    body: { barber: barberId, day, start: 600, end: 720 },
    secret,
  });
  hourId = newHour.json?.hour?.id ?? "";
  check("POST /api/admin/hours", newHour.status === 201 && Boolean(hourId), `status ${newHour.status}`);

  const afterHour = await call(
    `/api/availability?barber=${barberId}&date=${date}&service=${serviceId}`,
  );
  check(
    "/api/availability respects the new hour row",
    afterHour.status === 200 &&
      Array.isArray(afterHour.json?.slots) &&
      afterHour.json.slots.some((slot) => slot.start === 600),
    `status ${afterHour.status}, ${afterHour.json?.slots?.length ?? 0} slots`,
  );

  const publicBarbers = await call("/api/barbers");
  check(
    "public /api/barbers includes the new barber",
    publicBarbers.status === 200 &&
      publicBarbers.json.barbers.some((row) => row.id === barberId),
    `status ${publicBarbers.status}`,
  );

  // A same-day override narrows the weekly window to 10:00–10:30.
  const newDay = await call("/api/admin/days", {
    method: "POST",
    body: { barber: barberId, date, open: true, start: 600, end: 630, note: "QA" },
    secret,
  });
  dayId = newDay.json?.day?.id ?? "";
  check("POST /api/admin/days", newDay.status === 201 && Boolean(dayId), `status ${newDay.status}`);

  const afterDay = await call(
    `/api/availability?barber=${barberId}&date=${date}&service=${serviceId}`,
  );
  check(
    "date override narrows availability",
    afterDay.status === 200 &&
      afterDay.json.slots.length === 1 &&
      afterDay.json.slots[0].start === 600,
    `${afterDay.json?.slots?.length ?? 0} slots`,
  );

  // --- take the chair offline --------------------------------------------
  const patched = await call("/api/admin/barbers", {
    method: "PATCH",
    body: { id: barberId, active: false },
    secret,
  });
  check(
    "PATCH /api/admin/barbers sets active false",
    patched.status === 200 && patched.json?.barber?.active === false,
    `status ${patched.status}`,
  );

  const offlineBarbers = await call("/api/barbers");
  check(
    "inactive barber is gone from public list",
    offlineBarbers.status === 200 &&
      !offlineBarbers.json.barbers.some((row) => row.id === barberId),
    `status ${offlineBarbers.status}`,
  );

  // --- deletes ------------------------------------------------------------
  const deletedHour = await call(`/api/admin/hours?id=${hourId}`, { method: "DELETE", secret });
  check("DELETE /api/admin/hours", deletedHour.status === 200 && deletedHour.json?.ok === true, `status ${deletedHour.status}`);
  hourId = "";

  const deletedDay = await call(`/api/admin/days?id=${dayId}`, { method: "DELETE", secret });
  check("DELETE /api/admin/days", deletedDay.status === 200 && deletedDay.json?.ok === true, `status ${deletedDay.status}`);
  dayId = "";
}

try {
  await main();
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
