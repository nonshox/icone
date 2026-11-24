/**
 * Barber application probe: apply → approve → chair + role created.
 *   node qa-applications.mjs
 */
import fs from "node:fs";
import { Account, Client, Databases, Query, Users } from "node-appwrite";

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
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function signIn(label) {
  const email = `icone.qa.apply.${label}.${Date.now()}@mailinator.com`;
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
  return { id: otp, secret: cookieValue(verify.headers.getSetCookie(), "icone_session") };
}

let applicant = null;
let adminUser = null;
let applicationId = "";
let chairId = "";

async function cleanup() {
  if (chairId) {
    await db.deleteDocument({ databaseId, collectionId: "barbers", documentId: chairId }).catch(() => {});
  }
  if (applicationId) {
    await db.deleteDocument({ databaseId, collectionId: "applications", documentId: applicationId }).catch(() => {});
  }
  for (const user of [applicant, adminUser]) {
    if (!user) continue;
    await db.deleteDocument({ databaseId, collectionId: "users", documentId: user.id }).catch(() => {});
    await users.delete({ userId: user.id }).catch(() => {});
  }
}

try {
  applicant = await signIn("user");
  adminUser = await signIn("admin");
  await db.updateDocument({
    databaseId,
    collectionId: "users",
    documentId: adminUser.id,
    data: { role: "admin" },
  });

  const applied = await call("/api/applications", {
    method: "POST",
    secret: applicant.secret,
    body: {
      name: "QA Applicant",
      shop: "QA Chair",
      city: "Tashkent",
      address: "12 Amir Temur Avenue",
      phone: "+998900000000",
      bio: "Fades and beard work.",
    },
  });
  applicationId = applied.json?.application?.id ?? "";
  check("apply to become a barber", applied.status === 201 && Boolean(applicationId), `status ${applied.status}`);

  const mine = await call("/api/applications", { secret: applicant.secret });
  check("own application shows pending", mine.json?.application?.state === "pending");

  const clientForbidden = await call("/api/admin/applications", { secret: applicant.secret });
  check("client cannot review applications", clientForbidden.status === 403, `status ${clientForbidden.status}`);

  const queue = await call("/api/admin/applications", { secret: adminUser.secret });
  check("admin sees the queue", queue.status === 200 && queue.json.applications.some((a) => a.id === applicationId));

  const decided = await call("/api/admin/applications", {
    method: "PATCH",
    secret: adminUser.secret,
    body: { id: applicationId, decision: "approved", note: "Welcome" },
  });
  check("admin approves", decided.status === 200 && decided.json?.application?.state === "approved", `status ${decided.status}`);

  const after = await call("/api/applications", { secret: applicant.secret });
  check("applicant sees approval", after.json?.application?.state === "approved");

  const profile = await db.getDocument({ databaseId, collectionId: "users", documentId: applicant.id });
  check("applicant role is barber", profile.role === "barber", `role ${profile.role}`);

  const chairs = await db.listDocuments({
    databaseId,
    collectionId: "barbers",
    queries: [Query.equal("user", applicant.id), Query.limit(1)],
  });
  chairId = chairs.documents[0]?.$id ?? "";
  check("chair was created and linked", Boolean(chairId) && chairs.documents[0]?.shop === "QA Chair");

  const dashboard = await call("/api/barber/dashboard", { secret: applicant.secret });
  check("new barber can open business dashboard", dashboard.status === 200, `status ${dashboard.status}`);
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
