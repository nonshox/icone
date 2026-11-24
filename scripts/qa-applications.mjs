/**
 * Barber application probe: apply → approve → role + chair + dashboard.
 * It also deletes the chair to prove the staff entry point repairs the link.
 *   node qa-applications.mjs
 */
import { Client, Databases, Query, Users } from "node-appwrite";

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

async function chairFor(userId) {
  const chairs = await db.listDocuments({
    databaseId,
    collectionId: "barbers",
    queries: [Query.equal("user", userId), Query.limit(1)],
  });
  return chairs.documents[0] ?? null;
}

let applicant = null;
let adminUser = null;
let applicationId = "";

async function cleanup() {
  if (applicant) {
    for (const chair of [await chairFor(applicant.id).catch(() => null)].filter(Boolean)) {
      await db
        .deleteDocument({ databaseId, collectionId: "barbers", documentId: chair.$id })
        .catch(() => {});
    }
  }
  if (applicationId) {
    await db
      .deleteDocument({ databaseId, collectionId: "applications", documentId: applicationId })
      .catch(() => {});
  }
  for (const user of [applicant, adminUser]) {
    if (!user) continue;
    await db
      .deleteDocument({ databaseId, collectionId: "users", documentId: user.id })
      .catch(() => {});
    await users.delete({ userId: user.id }).catch(() => {});
  }
}

try {
  applicant = await signIn("applicant");
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

  const chair = await chairFor(applicant.id);
  check("chair was created and linked", Boolean(chair) && chair.shop === "QA Chair");

  const dashboard = await call("/api/barber/dashboard", { secret: applicant.secret });
  check("new barber can open business dashboard", dashboard.status === 200, `status ${dashboard.status}`);

  if (chair) {
    await db.deleteDocument({ databaseId, collectionId: "barbers", documentId: chair.$id });
  }
  const repaired = await call("/api/barber/dashboard", { secret: applicant.secret });
  const newChair = await chairFor(applicant.id);
  check(
    "missing chair is repaired on first staff request",
    repaired.status === 200 && Boolean(newChair),
    `status ${repaired.status}`,
  );
} finally {
  await cleanup();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
