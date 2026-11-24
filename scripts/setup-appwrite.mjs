/**
 * Creates the Appwrite schema for icone and seeds the catalogue.
 *
 *   node scripts/setup-appwrite.mjs
 *
 * Idempotent: existing collections, attributes, indexes and seed documents are
 * left untouched, so it is safe to re-run after a partial failure.
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
    ],
    indexes: [
      { key: "active", attributes: ["active"] },
      { key: "user", attributes: ["user"] },
    ],
  },

  services: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "price", type: "integer", min: 0 },
      { key: "time", type: "integer", min: 5, max: 240 },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [{ key: "active", attributes: ["active"] }],
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

const services = [
  {
    id: "svc_cut",
    name: "Signature cut",
    note: "Consultation, wash, precision cut and finish.",
    price: 80000,
    time: 45,
  },
  {
    id: "svc_beard",
    name: "Beard sculpt",
    note: "Line-up, shape and hot-towel finish.",
    price: 50000,
    time: 30,
  },
  {
    id: "svc_full",
    name: "The full reset",
    note: "Cut, beard, hot towel and styling.",
    price: 120000,
    time: 75,
  },
];

const barbers = [
  {
    id: "brb_bekzod",
    name: "Bekzod R.",
    title: "Senior barber",
    bio: "Fades, skin work and beard sculpting. Nine years on the floor.",
    rating: 4.9,
  },
  {
    id: "brb_aziz",
    name: "Aziz K.",
    title: "Barber",
    bio: "Scissor work and classic cuts. Calm hands, sharp lines.",
    rating: 4.8,
  },
  {
    id: "brb_timur",
    name: "Timur S.",
    title: "Barber",
    bio: "Textured crops, modern shapes and kids' cuts.",
    rating: 4.7,
  },
];

const week = [
  { day: 1, start: 600, end: 1260 },
  { day: 2, start: 600, end: 1260 },
  { day: 3, start: 600, end: 1260 },
  { day: 4, start: 600, end: 1260 },
  { day: 5, start: 600, end: 1320 },
  { day: 6, start: 660, end: 1320 },
];

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

  log("\nseed");
  if (await isEmpty("services")) {
    for (const service of services) {
      await db.createDocument({
        databaseId,
        collectionId: "services",
        documentId: service.id,
        data: {
          name: service.name,
          note: service.note,
          price: service.price,
          time: service.time,
          active: true,
        },
      });
    }
    log(`  + ${services.length} services`);
  } else {
    log("  = services already seeded");
  }

  if (await isEmpty("barbers")) {
    for (const barber of barbers) {
      await db.createDocument({
        databaseId,
        collectionId: "barbers",
        documentId: barber.id,
        data: {
          name: barber.name,
          title: barber.title,
          bio: barber.bio,
          photo: "",
          rating: barber.rating,
          active: true,
          user: "",
        },
      });
    }
    log(`  + ${barbers.length} barbers`);
  } else {
    log("  = barbers already seeded");
  }

  if (await isEmpty("hours")) {
    for (const barber of barbers) {
      for (const row of week) {
        await db.createDocument({
          databaseId,
          collectionId: "hours",
          documentId: ID.unique(),
          data: { barber: barber.id, ...row },
        });
      }
    }
    log(`  + ${barbers.length * week.length} hour rows`);
  } else {
    log("  = hours already seeded");
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
