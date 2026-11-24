/**
 * Promote a member to staff, or link an account to a barber chair.
 *
 *   node scripts/staff.mjs you@example.com barber [barberId]
 *   node scripts/staff.mjs tg_123456789 admin
 *
 * Roles: client | barber | admin. Requires documents.write on the key.
 */
import fs from "node:fs";
import { Client, Databases, Query, Users } from "node-appwrite";

function readEnv() {
  const file = fs.readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    file
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const [identifier, role, barber] = process.argv.slice(2);
const roles = ["client", "barber", "admin"];

if (!identifier || !roles.includes(role)) {
  console.error(
    "Usage: node scripts/staff.mjs <email-or-userId> <client|barber|admin> [barberId]",
  );
  process.exit(1);
}

const env = readEnv();
const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(client);
const db = new Databases(client);
const databaseId = env.APPWRITE_DATABASE_ID;

let account;
if (identifier.includes("@")) {
  const found = await users.list({
    queries: [Query.equal("email", identifier)],
    total: true,
  });
  account = found.users[0];
} else {
  account = await users.get({ userId: identifier });
}

if (!account) {
  console.error(`No Appwrite user found for ${identifier}`);
  process.exit(1);
}

await db.updateDocument({
  databaseId,
  collectionId: "users",
  documentId: account.$id,
  data: { role },
});
console.log(`${account.$id} → ${role}`);

if (barber) {
  await db.updateDocument({
    databaseId,
    collectionId: "barbers",
    documentId: barber,
    data: { user: account.$id },
  });
  console.log(`${barber} → linked to ${account.$id}`);
}
