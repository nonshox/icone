/**
 * Forward-only schema migrations for icone — deploys, not fresh installs.
 * (Fresh installs use `npm run db:setup`, which seeds the version document.)
 *
 *   node scripts/migrate.mjs
 *
 * The current version lives in `migrations/schema`. Every step is additive and
 * idempotent: it creates missing collections, attributes and indexes only.
 * No live row is ever updated, deleted or backfilled. The last step only
 * reports data-quality counts. Keep SCHEMA_VERSION in setup-appwrite.mjs in
 * sync with the last step below.
 */
import fs from "node:fs";
import { Client, Databases, Query } from "node-appwrite";

/** Must match SCHEMA_VERSION in scripts/setup-appwrite.mjs. */
const SCHEMA_VERSION = 6;
const MIGRATIONS = "migrations";
const VERSION_DOCUMENT = "schema";
const PAGE_SIZE = 100;

function readEnv() {
  const file = fs.readFileSync(".env", "utf8");
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

const env = readEnv();
const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const db = new Databases(client);
const databaseId = env.APPWRITE_DATABASE_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(message);

function isMissing(error) {
  return error?.code === 404;
}

async function ensureCollection(collectionId) {
  try {
    await db.getCollection({ databaseId, collectionId });
    log(`  = ${collectionId}`);
  } catch (error) {
    if (!isMissing(error)) throw error;
    await db.createCollection({
      databaseId,
      collectionId,
      name: collectionId,
      permissions: [],
      documentSecurity: false,
    });
    log(`  + ${collectionId}`);
  }
}

async function createAttribute(collectionId, spec) {
  const common = {
    databaseId,
    collectionId,
    key: spec.key,
    required: spec.required ?? false,
  };
  if (spec.type === "string") {
    await db.createStringAttribute({
      ...common,
      size: spec.size,
      xdefault: spec.default ?? null,
    });
  } else if (spec.type === "integer") {
    await db.createIntegerAttribute({
      ...common,
      min: spec.min ?? null,
      max: spec.max ?? null,
      xdefault: spec.default ?? null,
    });
  } else if (spec.type === "boolean") {
    await db.createBooleanAttribute({
      ...common,
      xdefault: spec.default ?? null,
    });
  } else {
    throw new Error(`unknown attribute type ${spec.type}`);
  }
  log(`    + ${collectionId}.${spec.key} (${spec.type})`);
}

async function waitForAttributes(collectionId, keys) {
  if (keys.length === 0) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const collection = await db.getCollection({ databaseId, collectionId });
    const pending = collection.attributes.filter(
      (attribute) =>
        keys.includes(attribute.key) && attribute.status !== "available",
    );
    if (pending.length === 0) return;
    await sleep(500);
  }
  throw new Error(`attributes still processing on ${collectionId}`);
}

async function ensureIndex(collectionId, spec) {
  const collection = await db.getCollection({ databaseId, collectionId });
  if (collection.indexes.some((index) => index.key === spec.key)) return;
  await db.createIndex({
    databaseId,
    collectionId,
    key: spec.key,
    type: spec.type ?? "key",
    attributes: spec.attributes,
  });
  log(`    + ${collectionId}.${spec.key} (${spec.attributes.join(", ")})`);
}

async function ensureAttribute(collectionId, spec) {
  const collection = await db.getCollection({ databaseId, collectionId });
  if (collection.attributes.some((attribute) => attribute.key === spec.key)) {
    return;
  }
  await createAttribute(collectionId, spec);
}

/** Create a whole collection definition, tolerating any part already in place. */
async function ensureCollectionDefinition(collectionId, definition) {
  await ensureCollection(collectionId);
  for (const attribute of definition.attributes) {
    await ensureAttribute(collectionId, attribute);
  }
  await waitForAttributes(
    collectionId,
    definition.attributes.map((attribute) => attribute.key),
  );
  for (const index of definition.indexes ?? []) {
    await ensureIndex(collectionId, index);
  }
}

/** Page through a whole collection by cursor; select only the needed keys. */
async function allDocuments(collectionId, keys) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const queries = [Query.orderAsc("$id"), Query.limit(PAGE_SIZE)];
    if (keys.length) queries.push(Query.select(keys));
    if (cursor) queries.push(Query.cursorAfter(cursor));

    let page;
    try {
      page = await db.listDocuments({ databaseId, collectionId, queries });
    } catch (error) {
      if (isMissing(error)) {
        log(`  report: ${collectionId} not present — zero rows`);
        return rows;
      }
      throw error;
    }
    rows.push(...page.documents);
    if (page.documents.length < PAGE_SIZE) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return rows;
}

/**
 * Business-root report, also observation-only. It counts businesses without
 * an active owner membership and barber rows whose business or branch does not
 * agree with their memberships. Only counts are printed; no row is touched.
 */
async function businessRootReport() {
  const text = (value) => (typeof value === "string" ? value : "");

  const businesses = await allDocuments("businesses", ["owner"]);
  const memberships = await allDocuments("memberships", [
    "user",
    "barber",
    "business",
    "branch",
    "role",
    "state",
    "active",
  ]);
  const active = memberships.filter(
    (row) => text(row.state) === "active" && row.active !== false,
  );
  const owned = new Set(
    active
      .filter((row) => text(row.role) === "owner")
      .map((row) => text(row.business)),
  );
  const noOwner = businesses.filter((row) => !owned.has(row.$id)).length;
  log(
    `  report: businesses — ${businesses.length} rows, ` +
      `${noOwner} with no active owner membership`,
  );

  const barbers = await allDocuments("barbers", ["user", "business", "branch"]);
  const byBarber = new Map();
  const byUser = new Map();
  for (const row of active) {
    const barberId = text(row.barber);
    const userId = text(row.user);
    if (barberId) {
      byBarber.set(barberId, [...(byBarber.get(barberId) ?? []), row]);
    }
    if (userId) {
      byUser.set(userId, [...(byUser.get(userId) ?? []), row]);
    }
  }

  let businessMismatch = 0;
  let branchMismatch = 0;
  let noMembership = 0;
  for (const row of barbers) {
    const business = text(row.business);
    if (!business) continue; // an independent chair has no business to compare
    const links = [
      ...(byBarber.get(row.$id) ?? []),
      ...(byUser.get(text(row.user)) ?? []),
    ];
    if (links.length === 0) {
      noMembership += 1;
      continue;
    }
    if (links.some((member) => text(member.business) !== business)) {
      businessMismatch += 1;
    }
    const branch = text(row.branch);
    if (
      links.some((member) => {
        const assigned = text(member.branch);
        return assigned !== "" && assigned !== branch;
      })
    ) {
      branchMismatch += 1;
    }
  }
  log(
    `  report: barbers — ${barbers.length} rows, ` +
      `${businessMismatch} whose business disagrees with a membership, ` +
      `${branchMismatch} whose branch disagrees, ` +
      `${noMembership} with a business but no matching membership`,
  );
}

/**
 * Version 6 is intentionally observation-only. It prints counts for the
 * relationships the next product model will need to reconcile, and writes
 * nothing. Duplicate `clients` (business, phone) are reported with both the
 * number of colliding groups and the number of rows in them.
 */
async function relationshipReport() {
  const text = (value) => (typeof value === "string" ? value : "");

  const clients = await allDocuments("clients", ["business", "phone"]);
  const groups = new Map();
  for (const row of clients) {
    const key = `${text(row.business)}\u0000${text(row.phone)}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const colliding = [...groups.values()].filter((count) => count > 1);
  log(
    `  report: clients — ${clients.length} rows, ` +
      `${colliding.length} duplicate (business, phone) groups, ` +
      `${colliding.reduce((sum, count) => sum + count, 0)} rows in those groups`,
  );

  const users = await allDocuments("users", []);
  const userIds = new Set(users.map((row) => row.$id));

  const barbers = await allDocuments("barbers", ["user"]);
  const barbersById = new Map(barbers.map((row) => [row.$id, row]));
  const orphanBarbers = barbers.filter((row) => {
    const linked = text(row.user);
    return linked !== "" && !userIds.has(linked);
  });
  log(`  report: barbers — ${barbers.length} rows, ${orphanBarbers.length} with a user id that has no account`);

  const memberships = await allDocuments("memberships", ["user", "barber"]);
  let missingBarber = 0;
  let linkedToAnotherUser = 0;
  for (const row of memberships) {
    const barberId = text(row.barber);
    if (barberId === "") continue;
    const barber = barbersById.get(barberId);
    if (!barber) {
      missingBarber += 1;
      continue;
    }
    const barberUser = text(barber.user);
    const memberUser = text(row.user);
    if (barberUser && memberUser && barberUser !== memberUser) {
      linkedToAnotherUser += 1;
    }
  }
  log(
    `  report: memberships — ${memberships.length} rows, ` +
      `${missingBarber} with a barber id that has no profile, ` +
      `${linkedToAnotherUser} linked to a barber owned by a different account`,
  );
}

const steps = [
  {
    version: 1,
    name: "ratelimit collection",
    apply: async () =>
      ensureCollectionDefinition("ratelimit", {
        attributes: [
          { key: "count", type: "integer", min: 0, default: 0 },
          { key: "expires", type: "integer", min: 0, default: 0 },
        ],
        indexes: [],
      }),
  },
  {
    version: 2,
    name: "offers collection",
    apply: async () =>
      ensureCollectionDefinition("offers", {
        attributes: [
          { key: "barber", type: "string", size: 36, required: true },
          { key: "service", type: "string", size: 36, required: true },
          { key: "business", type: "string", size: 36, default: "" },
          { key: "price", type: "integer", min: 0, default: 0 },
          { key: "time", type: "integer", min: 0, default: 0 },
          { key: "active", type: "boolean", default: true },
          { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
        ],
        indexes: [
          { key: "pair", attributes: ["barber", "service"], type: "unique" },
        ],
      }),
  },
  {
    version: 3,
    name: "customers collection",
    apply: async () =>
      ensureCollectionDefinition("customers", {
        attributes: [
          { key: "business", type: "string", size: 36, default: "" },
          { key: "user", type: "string", size: 36, default: "" },
          { key: "phone", type: "string", size: 32, default: "" },
          { key: "name", type: "string", size: 64, required: true },
          { key: "note", type: "string", size: 512, default: "" },
          { key: "active", type: "boolean", default: true },
          { key: "aliases", type: "string", size: 2048, default: "" },
        ],
        indexes: [
          { key: "business", attributes: ["business"] },
          { key: "user", attributes: ["user"] },
          { key: "phone", attributes: ["phone"] },
        ],
      }),
  },
  {
    version: 4,
    name: "conversations collection",
    apply: async () =>
      ensureCollectionDefinition("conversations", {
        attributes: [
          { key: "id1", type: "string", size: 36, required: true },
          { key: "id2", type: "string", size: 36, required: true },
          { key: "pair", type: "string", size: 80, required: true },
          { key: "last", type: "string", size: 1024, default: "" },
          { key: "lastAt", type: "integer", min: 0, default: 0 },
          { key: "unread1", type: "integer", min: 0, default: 0 },
          { key: "unread2", type: "integer", min: 0, default: 0 },
        ],
        indexes: [
          { key: "pair", attributes: ["pair"], type: "unique" },
        ],
      }),
  },
  {
    version: 5,
    name: "booking customer and appointment timestamp",
    apply: async () => {
      await ensureCollection("bookings");
      await ensureCollection("apptlog");
      await ensureAttribute("bookings", {
        key: "customer",
        type: "string",
        size: 36,
        default: "",
      });
      await ensureAttribute("apptlog", {
        key: "at",
        type: "integer",
        min: 0,
        default: 0,
      });
      await waitForAttributes("bookings", ["customer"]);
      await waitForAttributes("apptlog", ["at"]);
    },
  },
  {
    version: 6,
    name: "relationship and business-root report (read only)",
    apply: async () => {
      await relationshipReport();
      await businessRootReport();
    },
  },
];

async function currentVersion() {
  try {
    const document = await db.getDocument({
      databaseId,
      collectionId: MIGRATIONS,
      documentId: VERSION_DOCUMENT,
    });
    return Number(document.version ?? 0);
  } catch (error) {
    if (!isMissing(error)) throw error;
    await db.createDocument({
      databaseId,
      collectionId: MIGRATIONS,
      documentId: VERSION_DOCUMENT,
      data: { version: 0, at: Date.now(), note: "migrate" },
    });
    return 0;
  }
}

async function recordVersion(version) {
  await db.updateDocument({
    databaseId,
    collectionId: MIGRATIONS,
    documentId: VERSION_DOCUMENT,
    data: { version, at: Date.now(), note: "migrate" },
  });
}

async function main() {
  if (steps.length !== SCHEMA_VERSION) {
    throw new Error(
      `migration steps (${steps.length}) do not match SCHEMA_VERSION (${SCHEMA_VERSION})`,
    );
  }

  try {
    await db.listCollections({ databaseId, queries: [Query.limit(1)] });
  } catch (error) {
    if (error.code === 401) {
      log(
        "The API key is missing database scopes. In Appwrite console →\n" +
          "Project → API Keys → your server key, enable: databases.read/write,\n" +
          "collections.read/write, attributes.read/write, indexes.read/write,\n" +
          "documents.read/write. Then re-run this script.\n",
      );
      process.exit(1);
    }
    throw error;
  }

  // The version document must exist even on a database created before this
  // runner shipped. Creating it is bookkeeping, never a data migration.
  await ensureCollectionDefinition(MIGRATIONS, {
    attributes: [
      { key: "version", type: "integer", min: 0, default: 0 },
      { key: "at", type: "integer", min: 0, default: 0 },
      { key: "note", type: "string", size: 128, default: "" },
    ],
    indexes: [],
  });
  let version = await currentVersion();
  log(`Database: ${databaseId} — schema version ${version}\n`);

  for (const step of steps) {
    if (step.version <= version) continue;
    log(`step ${step.version}: ${step.name}`);
    await step.apply();
    version = step.version;
    await recordVersion(version);
    log(`  ✓ version ${version} recorded\n`);
  }

  log(`done — schema version ${version} (no live rows modified)\n`);
}

await main();
