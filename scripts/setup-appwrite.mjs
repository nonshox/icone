/**
 * Creates the Appwrite schema for icone and seeds only service categories.
 * Barbers and services come from real accounts, not sample rows.
 *
 *   node scripts/setup-appwrite.mjs
 *
 * Idempotent: existing collections, attributes and indexes are left untouched,
 * so it is safe to re-run after a partial failure.
 *
 * Naming rules for this project: one word per table, one word per key.
 */
import fs from "node:fs";
import { Client, Databases, ID, Query } from "node-appwrite";

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

const schema = {
  users: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "role", type: "string", size: 16, default: "client" },
      { key: "avatar", type: "string", size: 512, default: "" },
    ],
    indexes: [{ key: "role", attributes: ["role"] }],
  },

  barbers: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 64, default: "" },
      { key: "bio", type: "string", size: 512, default: "" },
      { key: "photo", type: "string", size: 512, default: "" },
      { key: "rating", type: "float", default: 0 },
      { key: "active", type: "boolean", default: true },
      { key: "user", type: "string", size: 36, default: "" },
      { key: "shop", type: "string", size: 64, default: "" },
      { key: "address", type: "string", size: 128, default: "" },
      { key: "city", type: "string", size: 64, default: "Tashkent" },
      { key: "years", type: "integer", min: 0, max: 80, default: 0 },
      { key: "skills", type: "string", size: 256, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "social", type: "string", size: 256, default: "" },
      { key: "facilities", type: "string", size: 256, default: "" },
      { key: "policy", type: "string", size: 512, default: "" },
      { key: "cover", type: "string", size: 512, default: "" },
      { key: "confirm", type: "boolean", default: false },
      { key: "featured", type: "boolean", default: false },
    ],
    indexes: [
      { key: "active", attributes: ["active"] },
      { key: "user", attributes: ["user"] },
      { key: "city", attributes: ["city"] },
    ],
  },

  services: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "price", type: "integer", min: 0 },
      { key: "time", type: "integer", min: 5, max: 240 },
      { key: "active", type: "boolean", default: true },
      { key: "image", type: "string", size: 512, default: "" },
      { key: "category", type: "string", size: 32, default: "Hair" },
      { key: "featured", type: "boolean", default: false },
      { key: "discount", type: "integer", min: 0, max: 100, default: 0 },
      { key: "barber", type: "string", size: 36, default: "" },
    ],
    indexes: [
      { key: "active", attributes: ["active"] },
      { key: "owner", attributes: ["barber"] },
      { key: "category", attributes: ["category"] },
    ],
  },

  // Weekly opening hours, one row per barber per weekday.
  hours: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "day", type: "integer", min: 0, max: 6 },
      { key: "start", type: "integer", min: 0, max: 1440 },
      { key: "end", type: "integer", min: 0, max: 1440 },
    ],
    indexes: [{ key: "week", attributes: ["barber", "day"] }],
  },

  // Date overrides: a closed day, or different hours for one date.
  days: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "date", type: "string", size: 10, required: true },
      { key: "open", type: "boolean", default: false },
      { key: "start", type: "integer", min: 0, max: 1440, default: 0 },
      { key: "end", type: "integer", min: 0, max: 1440, default: 0 },
      { key: "note", type: "string", size: 64, default: "" },
    ],
    indexes: [{ key: "lookup", attributes: ["barber", "date"] }],
  },

  bookings: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
      { key: "service", type: "string", size: 36, required: true },
      { key: "date", type: "string", size: 10, required: true },
      { key: "start", type: "integer", min: 0, max: 1440 },
      { key: "end", type: "integer", min: 0, max: 1440 },
      { key: "price", type: "integer", min: 0 },
      { key: "status", type: "string", size: 12, default: "booked" },
      { key: "note", type: "string", size: 256, default: "" },
    ],
    indexes: [
      { key: "slot", attributes: ["barber", "date", "status"] },
      { key: "mine", attributes: ["user", "date"] },
      { key: "agenda", attributes: ["date", "status"] },
    ],
  },

  reviews: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
      { key: "booking", type: "string", size: 36, required: true },
      { key: "rate", type: "integer", min: 1, max: 5 },
      { key: "note", type: "string", size: 512, default: "" },
    ],
    indexes: [
      { key: "about", attributes: ["barber"] },
      { key: "once", attributes: ["booking"], type: "unique" },
    ],
  },

  // One queued Telegram reminder per booking. `date` is the day it is due,
  // `at` the minute-of-day target; `once` makes repeated runs harmless.
  reminders: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "booking", type: "string", size: 36, required: true },
      { key: "date", type: "string", size: 10, required: true },
      { key: "at", type: "integer", min: 0, max: 1439, required: true },
      { key: "state", type: "string", size: 12, default: "pending" },
      { key: "tries", type: "integer", min: 0, max: 100, default: 0 },
    ],
    indexes: [
      { key: "due", attributes: ["date", "state"] },
      { key: "once", attributes: ["booking"], type: "unique" },
    ],
  },

  favorites: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
    ],
    indexes: [{ key: "mine", attributes: ["user", "barber"], type: "unique" }],
  },

  notifications: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "title", type: "string", size: 96, required: true },
      { key: "body", type: "string", size: 512, default: "" },
      { key: "kind", type: "string", size: 24, default: "info" },
      { key: "state", type: "string", size: 12, default: "new" },
    ],
    indexes: [{ key: "inbox", attributes: ["user", "state"] }],
  },

  messages: {
    attributes: [
      { key: "conversation", type: "string", size: 80, required: true },
      { key: "sender", type: "string", size: 36, required: true },
      { key: "body", type: "string", size: 1024, required: true },
    ],
    indexes: [{ key: "thread", attributes: ["conversation"] }],
  },

  promotions: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "name", type: "string", size: 64, required: true },
      { key: "kind", type: "string", size: 12, default: "percent" },
      { key: "amount", type: "integer", min: 0 },
      { key: "start", type: "string", size: 10, default: "" },
      { key: "end", type: "string", size: 10, default: "" },
      { key: "uses", type: "integer", min: 0, default: 0 },
      { key: "limit", type: "integer", min: 0, default: 0 },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [{ key: "shop", attributes: ["barber", "active"] }],
  },

  notes: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "user", type: "string", size: 36, required: true },
      { key: "note", type: "string", size: 512, default: "" },
    ],
    indexes: [{ key: "pair", attributes: ["barber", "user"], type: "unique" }],
  },

  payments: {
    attributes: [
      { key: "booking", type: "string", size: 36, required: true },
      { key: "amount", type: "integer", min: 0 },
      { key: "status", type: "string", size: 16, default: "pending" },
      { key: "method", type: "string", size: 16, default: "shop" },
    ],
    indexes: [{ key: "for", attributes: ["booking"] }],
  },

  portfolio: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "url", type: "string", size: 512, required: true },
      { key: "note", type: "string", size: 128, default: "" },
    ],
    indexes: [{ key: "owner", attributes: ["barber"] }],
  },

  categories: {
    attributes: [
      { key: "name", type: "string", size: 32, required: true },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [{ key: "active", attributes: ["active"] }],
  },

  applications: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "name", type: "string", size: 64, required: true },
      { key: "shop", type: "string", size: 64, default: "" },
      { key: "city", type: "string", size: 64, default: "Tashkent" },
      { key: "address", type: "string", size: 128, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "bio", type: "string", size: 512, default: "" },
      { key: "state", type: "string", size: 12, default: "pending" },
      { key: "note", type: "string", size: 256, default: "" },
    ],
    indexes: [
      { key: "queue", attributes: ["state"] },
      { key: "mine", attributes: ["user"], type: "unique" },
    ],
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  console.log(message);
}

async function ensureCollection(id) {
  try {
    await db.getCollection({ databaseId, collectionId: id });
    log(`  = ${id}`);
  } catch (error) {
    if (error.code !== 404) throw error;
    await db.createCollection({
      databaseId,
      collectionId: id,
      name: id,
      permissions: [],
      documentSecurity: false,
    });
    log(`  + ${id}`);
  }
}

async function ensureAttribute(collectionId, spec) {
  const existing = await db.getCollection({ databaseId, collectionId });
  if (existing.attributes.some((attribute) => attribute.key === spec.key)) {
    return;
  }

  if (spec.type === "string") {
    await db.createStringAttribute({
      databaseId,
      collectionId,
      key: spec.key,
      size: spec.size,
      required: spec.required ?? false,
      xdefault: spec.default ?? null,
    });
  } else if (spec.type === "integer") {
    await db.createIntegerAttribute({
      databaseId,
      collectionId,
      key: spec.key,
      required: spec.required ?? false,
      min: spec.min ?? null,
      max: spec.max ?? null,
      xdefault: spec.default ?? null,
    });
  } else if (spec.type === "float") {
    await db.createFloatAttribute({
      databaseId,
      collectionId,
      key: spec.key,
      required: spec.required ?? false,
      min: spec.min ?? null,
      max: spec.max ?? null,
      xdefault: spec.default ?? null,
    });
  } else if (spec.type === "boolean") {
    await db.createBooleanAttribute({
      databaseId,
      collectionId,
      key: spec.key,
      required: spec.required ?? false,
      xdefault: spec.default ?? null,
    });
  } else {
    throw new Error(`unknown attribute type ${spec.type}`);
  }

  log(`    + ${collectionId}.${spec.key} (${spec.type})`);
}

async function waitForAttributes(collectionId, keys) {
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

async function isEmpty(collectionId) {
  const { total } = await db.listDocuments({
    databaseId,
    collectionId,
    queries: [Query.limit(1)],
  });
  return total === 0;
}

async function main() {
  log(`\nDatabase: ${databaseId}\n`);

  // Fail early with an actionable message instead of seven identical 401s.
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

  try {
    await db.get({ databaseId });
  } catch (error) {
    if (error.code === 404) {
      await db.create({ databaseId, name: databaseId });
      log(`  + database ${databaseId}`);
    } else {
      throw error;
    }
  }

  for (const [collectionId, definition] of Object.entries(schema)) {
    log(`collection ${collectionId}`);
    await ensureCollection(collectionId);

    for (const attribute of definition.attributes) {
      await ensureAttribute(collectionId, attribute);
    }

    await waitForAttributes(
      collectionId,
      definition.attributes.map((attribute) => attribute.key),
    );

    for (const index of definition.indexes) {
      await ensureIndex(collectionId, index);
    }
  }

  if (await isEmpty("categories")) {
    for (const name of ["Hair", "Beard", "Combo", "Kids", "Styling"]) {
      await db.createDocument({
        databaseId,
        collectionId: "categories",
        documentId: ID.unique(),
        data: { name, active: true },
      });
    }
    log("  + 5 service categories");
  }

  const summary = await Promise.all(
    Object.keys(schema).map(async (collectionId) => {
      const { total } = await db.listDocuments({
        databaseId,
        collectionId,
        queries: [Query.limit(1)],
      });
      return `${collectionId}: ${total}`;
    }),
  );

  log(`\ndone — ${summary.join(", ")}\n`);
}

await main();
