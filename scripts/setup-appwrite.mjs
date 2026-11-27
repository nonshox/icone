/**
 * Creates the Appwrite schema for icone and seeds reference data only
 * (service categories, Uzbekistan cities and districts). Barbers, businesses
 * and services come from real accounts, not sample rows.
 *
 *   node scripts/setup-appwrite.mjs
 *
 * Idempotent: existing collections, attributes and indexes are left untouched,
 * so it is safe to re-run after a partial failure. Nothing is ever deleted.
 *
 * Naming rules for this project: one word per table, one word per key.
 *
 * Collections that predate the team model keep their original key names where
 * renaming would drop live rows — see docs/DATA.md for every such case.
 */
import fs from "node:fs";
import { Client, Databases, ID, Query, Storage } from "node-appwrite";

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
const storage = new Storage(client);
const databaseId = env.APPWRITE_DATABASE_ID;
const bucketId = env.APPWRITE_BUCKET_ID;

const schema = {
  /* ----------------------------------------------------------- accounts */

  users: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "role", type: "string", size: 16, default: "client" },
      { key: "avatar", type: "string", size: 512, default: "" },
      // Preferred UI language: uz (default), ru, en.
      { key: "locale", type: "string", size: 8, default: "uz" },
      // Notification preferences as a small JSON object.
      { key: "prefs", type: "string", size: 1024, default: "" },
      // Subscription tier. Never enforced at launch — see docs/PROJECT.md.
      { key: "plan", type: "string", size: 16, default: "free" },
      { key: "state", type: "string", size: 16, default: "active" },
    ],
    indexes: [
      { key: "role", attributes: ["role"] },
      { key: "state", attributes: ["state"] },
    ],
  },

  /* ------------------------------------------------- professional profile */

  // One row per professional. An independent barber has an empty `business`;
  // a shop employee points at the business and default branch they work for.
  barbers: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 64, default: "" },
      { key: "bio", type: "string", size: 1024, default: "" },
      { key: "photo", type: "string", size: 512, default: "" },
      { key: "rating", type: "float", default: 0 },
      { key: "active", type: "boolean", default: true },
      { key: "user", type: "string", size: 36, default: "" },
      { key: "shop", type: "string", size: 64, default: "" },
      { key: "address", type: "string", size: 160, default: "" },
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
      // --- team model ---
      { key: "business", type: "string", size: 36, default: "" },
      { key: "branch", type: "string", size: 36, default: "" },
      { key: "district", type: "string", size: 64, default: "" },
      { key: "slug", type: "string", size: 64, default: "" },
      { key: "lat", type: "float", default: 0 },
      { key: "lng", type: "float", default: 0 },
      { key: "langs", type: "string", size: 64, default: "" },
      { key: "verified", type: "boolean", default: false },
      { key: "state", type: "string", size: 16, default: "active" },
      // Minutes of dead time added after every appointment.
      { key: "buffer", type: "integer", min: 0, max: 120, default: 0 },
      // Public booking grid granularity, in minutes.
      { key: "step", type: "integer", min: 5, max: 60, default: 15 },
      { key: "views", type: "integer", min: 0, default: 0 },
    ],
    indexes: [
      { key: "active", attributes: ["active"] },
      { key: "user", attributes: ["user"] },
      { key: "city", attributes: ["city"] },
      { key: "shopowner", attributes: ["business"] },
      { key: "branchlink", attributes: ["branch"] },
      { key: "state", attributes: ["state"] },
    ],
  },

  /* ------------------------------------------------------- business model */

  businesses: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "owner", type: "string", size: 36, required: true },
      { key: "slug", type: "string", size: 64, default: "" },
      { key: "logo", type: "string", size: 512, default: "" },
      { key: "cover", type: "string", size: 512, default: "" },
      { key: "about", type: "string", size: 1024, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "city", type: "string", size: 64, default: "Tashkent" },
      { key: "district", type: "string", size: 64, default: "" },
      { key: "address", type: "string", size: 160, default: "" },
      { key: "lat", type: "float", default: 0 },
      { key: "lng", type: "float", default: 0 },
      { key: "facilities", type: "string", size: 256, default: "" },
      { key: "policy", type: "string", size: 512, default: "" },
      { key: "web", type: "string", size: 128, default: "" },
      // auto = bookings are confirmed instantly, manual = the shop approves.
      { key: "confirm", type: "boolean", default: true },
      // draft | review | active | suspended
      { key: "state", type: "string", size: 16, default: "draft" },
      { key: "verified", type: "boolean", default: false },
      { key: "active", type: "boolean", default: true },
      { key: "plan", type: "string", size: 16, default: "free" },
      { key: "rating", type: "float", default: 0 },
      { key: "seats", type: "integer", min: 0, max: 200, default: 0 },
      { key: "buffer", type: "integer", min: 0, max: 120, default: 0 },
      { key: "step", type: "integer", min: 5, max: 60, default: 15 },
      { key: "views", type: "integer", min: 0, default: 0 },
    ],
    indexes: [
      { key: "owner", attributes: ["owner"] },
      { key: "state", attributes: ["state"] },
      { key: "city", attributes: ["city"] },
      { key: "active", attributes: ["active"] },
    ],
  },

  branches: {
    attributes: [
      { key: "business", type: "string", size: 36, required: true },
      { key: "name", type: "string", size: 64, required: true },
      { key: "slug", type: "string", size: 64, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "city", type: "string", size: 64, default: "Tashkent" },
      { key: "district", type: "string", size: 64, default: "" },
      { key: "address", type: "string", size: 160, default: "" },
      { key: "lat", type: "float", default: 0 },
      { key: "lng", type: "float", default: 0 },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "active", type: "boolean", default: true },
      { key: "primary", type: "boolean", default: false },
      { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
    ],
    indexes: [
      { key: "owner", attributes: ["business"] },
      { key: "place", attributes: ["city"] },
    ],
  },

  memberships: {
    attributes: [
      { key: "business", type: "string", size: 36, required: true },
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, default: "" },
      { key: "branch", type: "string", size: 36, default: "" },
      // owner | manager | reception | barber
      { key: "role", type: "string", size: 16, default: "barber" },
      // invited | active | suspended | removed
      { key: "state", type: "string", size: 16, default: "active" },
      // Granular overrides on top of the role, as a JSON object.
      { key: "perms", type: "string", size: 1024, default: "" },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [
      { key: "pair", attributes: ["business", "user"], type: "unique" },
      { key: "mine", attributes: ["user"] },
      { key: "team", attributes: ["business", "state"] },
    ],
  },

  invites: {
    attributes: [
      { key: "business", type: "string", size: 36, required: true },
      { key: "role", type: "string", size: 16, default: "barber" },
      { key: "to", type: "string", size: 36, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "name", type: "string", size: 64, default: "" },
      { key: "token", type: "string", size: 64, required: true },
      { key: "by", type: "string", size: 36, default: "" },
      { key: "branch", type: "string", size: 36, default: "" },
      // pending | accepted | declined | revoked | expired
      { key: "state", type: "string", size: 16, default: "pending" },
      { key: "expires", type: "string", size: 32, default: "" },
    ],
    indexes: [
      { key: "token", attributes: ["token"], type: "unique" },
      { key: "mine", attributes: ["to"] },
      { key: "queue", attributes: ["business", "state"] },
    ],
  },

  /* ------------------------------------------------------------ services */

  // Exactly one of `barber` (independent) or `business` (shared catalogue) is
  // set. `discount` survives from the previous product and is unused.
  services: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "price", type: "integer", min: 0 },
      { key: "time", type: "integer", min: 5, max: 480 },
      { key: "active", type: "boolean", default: true },
      { key: "image", type: "string", size: 512, default: "" },
      { key: "category", type: "string", size: 32, default: "Hair" },
      { key: "featured", type: "boolean", default: false },
      { key: "discount", type: "integer", min: 0, max: 100, default: 0 },
      { key: "barber", type: "string", size: 36, default: "" },
      { key: "business", type: "string", size: 36, default: "" },
      { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
      { key: "buffer", type: "integer", min: 0, max: 120, default: 0 },
    ],
    indexes: [
      { key: "active", attributes: ["active"] },
      { key: "owner", attributes: ["barber"] },
      { key: "catalogue", attributes: ["business"] },
      { key: "category", attributes: ["category"] },
    ],
  },

  // Per-employee override of a shared catalogue service. A price or time of -1
  // means "inherit from the service".
  empser: {
    attributes: [
      { key: "business", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
      { key: "service", type: "string", size: 36, required: true },
      { key: "price", type: "integer", min: -1, default: -1 },
      { key: "time", type: "integer", min: -1, default: -1 },
      { key: "active", type: "boolean", default: true },
      { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
    ],
    indexes: [
      { key: "pair", attributes: ["barber", "service"], type: "unique" },
      { key: "staff", attributes: ["barber", "active"] },
      { key: "catalog", attributes: ["business"] },
    ],
  },

  /* ------------------------------------------------------------ schedule */

  // Weekly opening windows. `barber` holds the owner id — a professional, or
  // a branch when `kind` is "branch". The key predates the team model.
  hours: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "kind", type: "string", size: 16, default: "barber" },
      { key: "day", type: "integer", min: 0, max: 6 },
      { key: "start", type: "integer", min: 0, max: 1440 },
      { key: "end", type: "integer", min: 0, max: 1440 },
    ],
    indexes: [
      { key: "week", attributes: ["barber", "day"] },
      { key: "lookup", attributes: ["barber", "kind", "day"] },
    ],
  },

  // Recurring non-working windows inside a working window (lunch, prayers).
  breaks: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "kind", type: "string", size: 16, default: "barber" },
      { key: "day", type: "integer", min: 0, max: 6 },
      { key: "start", type: "integer", min: 0, max: 1440 },
      { key: "end", type: "integer", min: 0, max: 1440 },
      { key: "note", type: "string", size: 64, default: "" },
    ],
    indexes: [{ key: "week", attributes: ["barber", "day"] }],
  },

  // Per-date overrides: a closed day, holiday or different hours.
  days: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "kind", type: "string", size: 16, default: "barber" },
      { key: "date", type: "string", size: 10, required: true },
      { key: "open", type: "boolean", default: false },
      { key: "start", type: "integer", min: 0, max: 1440, default: 0 },
      { key: "end", type: "integer", min: 0, max: 1440, default: 0 },
      { key: "note", type: "string", size: 64, default: "" },
    ],
    indexes: [
      { key: "lookup", attributes: ["barber", "date"] },
      { key: "scope", attributes: ["barber", "kind", "date"] },
    ],
  },

  /* --------------------------------------------------------- appointments */

  bookings: {
    attributes: [
      { key: "user", type: "string", size: 36, default: "" },
      { key: "barber", type: "string", size: 36, required: true },
      { key: "service", type: "string", size: 36, default: "" },
      { key: "date", type: "string", size: 10, required: true },
      { key: "start", type: "integer", min: 0, max: 1440 },
      { key: "end", type: "integer", min: 0, max: 1440 },
      { key: "price", type: "integer", min: 0 },
      { key: "status", type: "string", size: 12, default: "booked" },
      { key: "note", type: "string", size: 256, default: "" },
      // --- team model ---
      { key: "business", type: "string", size: 36, default: "" },
      { key: "branch", type: "string", size: 36, default: "" },
      // Walk-in customer record; empty when the customer has an account.
      { key: "client", type: "string", size: 36, default: "" },
      // JSON array of service ids — one visit can hold several services.
      { key: "items", type: "string", size: 2048, default: "[]" },
      // online | walkin | manual
      { key: "source", type: "string", size: 16, default: "online" },
      { key: "innote", type: "string", size: 512, default: "" },
      { key: "createdby", type: "string", size: 36, default: "" },
    ],
    indexes: [
      { key: "slot", attributes: ["barber", "date", "status"] },
      { key: "mine", attributes: ["user", "date"] },
      { key: "agenda", attributes: ["date", "status"] },
      { key: "shop", attributes: ["business", "date"] },
      { key: "place", attributes: ["branch", "date"] },
      { key: "state", attributes: ["status"] },
      { key: "staffday", attributes: ["barber", "date"] },
    ],
  },

  // Append-only status trail for one appointment.
  apptlog: {
    attributes: [
      { key: "booking", type: "string", size: 36, required: true },
      { key: "from", type: "string", size: 12, default: "" },
      { key: "to", type: "string", size: 12, required: true },
      { key: "by", type: "string", size: 36, default: "" },
      { key: "note", type: "string", size: 256, default: "" },
      { key: "kind", type: "string", size: 24, default: "status" },
    ],
    indexes: [{ key: "thread", attributes: ["booking"] }],
  },

  // Walk-in / phone customers who have no account. Scoped to one business, or
  // to one independent barber when `business` is empty.
  clients: {
    attributes: [
      { key: "business", type: "string", size: 36, default: "" },
      { key: "barber", type: "string", size: 36, default: "" },
      { key: "user", type: "string", size: 36, default: "" },
      { key: "name", type: "string", size: 64, required: true },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "note", type: "string", size: 512, default: "" },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [
      { key: "shop", attributes: ["business"] },
      { key: "staff", attributes: ["barber"] },
      { key: "account", attributes: ["user"] },
      { key: "phone", attributes: ["phone"] },
    ],
  },

  /* ----------------------------------------------------------- discovery */

  reviews: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
      { key: "booking", type: "string", size: 36, required: true },
      { key: "rate", type: "integer", min: 1, max: 5 },
      { key: "note", type: "string", size: 512, default: "" },
      { key: "reply", type: "string", size: 512, default: "" },
      // open | hidden | reported
      { key: "state", type: "string", size: 16, default: "open" },
      { key: "business", type: "string", size: 36, default: "" },
    ],
    indexes: [
      { key: "about", attributes: ["barber"] },
      { key: "once", attributes: ["booking"], type: "unique" },
      { key: "state", attributes: ["state"] },
      { key: "shop", attributes: ["business"] },
    ],
  },

  favorites: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "barber", type: "string", size: 36, required: true },
    ],
    indexes: [{ key: "mine", attributes: ["user", "barber"], type: "unique" }],
  },

  // Service category labels. Seeded with reference data only.
  categories: {
    attributes: [
      { key: "name", type: "string", size: 32, required: true },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [{ key: "active", attributes: ["active"] }],
  },

  // Cities and districts, seeded from Uzbekistan reference data and editable
  // by platform admins.
  places: {
    attributes: [
      { key: "name", type: "string", size: 64, required: true },
      { key: "ru", type: "string", size: 64, default: "" },
      { key: "en", type: "string", size: 64, default: "" },
      { key: "kind", type: "string", size: 12, default: "city" },
      { key: "parent", type: "string", size: 36, default: "" },
      { key: "lat", type: "float", default: 0 },
      { key: "lng", type: "float", default: 0 },
      { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [
      { key: "kind", attributes: ["kind"] },
      { key: "parent", attributes: ["parent"] },
    ],
  },

  portfolio: {
    attributes: [
      { key: "barber", type: "string", size: 36, required: true },
      { key: "url", type: "string", size: 512, required: true },
      { key: "note", type: "string", size: 128, default: "" },
      { key: "group", type: "string", size: 64, default: "" },
      { key: "sort", type: "integer", min: 0, max: 999, default: 0 },
      { key: "featured", type: "boolean", default: false },
      { key: "public", type: "boolean", default: true },
    ],
    indexes: [
      { key: "owner", attributes: ["barber"] },
      { key: "gallery", attributes: ["barber", "public"] },
    ],
  },

  /* ------------------------------------------------------- booking extras */

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

  // A customer's request for a slot that is not open. Polled by the barber
  // and by the cron runner, which pings Telegram on a match.
  waits: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "business", type: "string", size: 36, default: "" },
      { key: "branch", type: "string", size: 36, default: "" },
      { key: "barber", type: "string", size: 36, default: "" },
      { key: "service", type: "string", size: 36, default: "" },
      { key: "from", type: "string", size: 10, required: true },
      { key: "to", type: "string", size: 10, required: true },
      { key: "day", type: "integer", min: -1, max: 6, default: -1 },
      { key: "before", type: "integer", min: 0, max: 1439, default: 1439 },
      { key: "note", type: "string", size: 256, default: "" },
      // open | notified | booked | cancelled | expired
      { key: "state", type: "string", size: 12, default: "open" },
    ],
    indexes: [
      { key: "mine", attributes: ["user", "state"] },
      { key: "queue", attributes: ["barber", "state"] },
      { key: "shop", attributes: ["business", "state"] },
    ],
  },

  /* ------------------------------------------------------ communications */

  notifications: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "title", type: "string", size: 96, required: true },
      { key: "body", type: "string", size: 512, default: "" },
      { key: "kind", type: "string", size: 24, default: "info" },
      { key: "state", type: "string", size: 12, default: "new" },
      { key: "link", type: "string", size: 256, default: "" },
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

  /* ------------------------------------------------ onboarding & trust */

  applications: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "name", type: "string", size: 64, required: true },
      { key: "shop", type: "string", size: 64, default: "" },
      { key: "city", type: "string", size: 64, default: "Tashkent" },
      { key: "district", type: "string", size: 64, default: "" },
      { key: "address", type: "string", size: 160, default: "" },
      { key: "phone", type: "string", size: 32, default: "" },
      { key: "bio", type: "string", size: 1024, default: "" },
      { key: "state", type: "string", size: 12, default: "pending" },
      { key: "note", type: "string", size: 512, default: "" },
      // --- team model ---
      // a = independent barber, b = barbershop with a team
      { key: "model", type: "string", size: 4, default: "a" },
      // The barbers/business document this application created or will create.
      { key: "target", type: "string", size: 36, default: "" },
      { key: "reason", type: "string", size: 512, default: "" },
      // JSON array of { state, at, by, note } review steps.
      { key: "history", type: "string", size: 8192, default: "[]" },
      // Onboarding draft payload, kept while the applicant is mid-flow.
      { key: "payload", type: "string", size: 16384, default: "" },
    ],
    indexes: [
      { key: "queue", attributes: ["state"] },
      { key: "mine", attributes: ["user"], type: "unique" },
      { key: "linked", attributes: ["target"] },
    ],
  },

  reports: {
    attributes: [
      { key: "reporter", type: "string", size: 36, required: true },
      { key: "kind", type: "string", size: 16, default: "user" },
      { key: "target", type: "string", size: 36, required: true },
      { key: "note", type: "string", size: 512, default: "" },
      { key: "detail", type: "string", size: 512, default: "" },
      // open | review | resolved | rejected
      { key: "state", type: "string", size: 16, default: "open" },
      { key: "actor", type: "string", size: 36, default: "" },
    ],
    indexes: [
      { key: "queue", attributes: ["state"] },
      { key: "about", attributes: ["kind", "target"] },
    ],
  },

  tickets: {
    attributes: [
      { key: "user", type: "string", size: 36, required: true },
      { key: "topic", type: "string", size: 64, default: "" },
      { key: "body", type: "string", size: 1024, required: true },
      { key: "reply", type: "string", size: 1024, default: "" },
      { key: "state", type: "string", size: 16, default: "open" },
      { key: "actor", type: "string", size: 36, default: "" },
    ],
    indexes: [
      { key: "queue", attributes: ["state"] },
      { key: "mine", attributes: ["user"] },
    ],
  },

  // Append-only trail for sensitive platform and business operations.
  audit: {
    attributes: [
      { key: "actor", type: "string", size: 36, default: "" },
      { key: "action", type: "string", size: 48, required: true },
      { key: "kind", type: "string", size: 24, default: "" },
      { key: "target", type: "string", size: 36, default: "" },
      { key: "detail", type: "string", size: 512, default: "" },
    ],
    indexes: [
      { key: "by", attributes: ["actor"] },
      { key: "on", attributes: ["kind", "target"] },
      { key: "recent", attributes: ["action"] },
    ],
  },

  // Platform-wide switches. Exactly one row, id `platform`.
  settings: {
    attributes: [
      { key: "data", type: "string", size: 4096, default: "{}" },
      { key: "updatedby", type: "string", size: 36, default: "" },
    ],
    indexes: [],
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  console.log(message);
}

/** Storage must allow anonymous reads or public profile images 401. */
async function ensureBucket() {
  if (!bucketId) {
    log("bucket: APPWRITE_BUCKET_ID is not set — uploads are unavailable");
    return;
  }
  const permissions = ['read("any")'];
  try {
    const existing = await storage.getBucket({ bucketId });
    if (
      !existing.enabled ||
      JSON.stringify(existing.$permissions ?? []) !== JSON.stringify(permissions)
    ) {
      await storage.updateBucket({
        bucketId,
        name: existing.name || "icone",
        enabled: true,
        fileSecurity: false,
        permissions,
      });
      log(`bucket ${bucketId}: public read enabled`);
    } else {
      log(`bucket ${bucketId}: already public`);
    }
  } catch (error) {
    if (error.code !== 404) throw error;
    await storage.createBucket({
      bucketId,
      name: "icone",
      enabled: true,
      fileSecurity: false,
      permissions,
      maximumFileSize: 5 * 1024 * 1024,
      allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "avif"],
    });
    log(`bucket ${bucketId}: created with public read`);
  }
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

/** Uzbekistan reference data: 14 regions are folded into the 12 largest cities. */
const CITIES = [
  { id: "toshkent", name: "Toshkent", ru: "Ташкент", en: "Tashkent", lat: 41.311, lng: 69.24 },
  { id: "samarqand", name: "Samarqand", ru: "Самарканд", en: "Samarkand", lat: 39.627, lng: 66.975 },
  { id: "buxoro", name: "Buxoro", ru: "Бухара", en: "Bukhara", lat: 39.775, lng: 64.42 },
  { id: "namangan", name: "Namangan", ru: "Наманган", en: "Namangan", lat: 40.998, lng: 71.672 },
  { id: "andijon", name: "Andijon", ru: "Андижан", en: "Andijan", lat: 40.65, lng: 72.34 },
  { id: "navoiy", name: "Navoiy", ru: "Навои", en: "Navoi", lat: 40.084, lng: 65.379 },
  { id: "fargona", name: "Fargona", ru: "Фергана", en: "Fergana", lat: 40.386, lng: 71.786 },
  { id: "namozgoh", name: "Namozgoh", ru: "Намозгох", en: "Namozgoh", lat: 39.65, lng: 64.42 },
  { id: "qarshi", name: "Qarshi", ru: "Карши", en: "Karshi", lat: 38.86, lng: 65.799 },
  { id: "nukus", name: "Nukus", ru: "Нукус", en: "Nukus", lat: 42.453, lng: 59.61 },
  { id: "xiva", name: "Xiva", ru: "Хива", en: "Khiva", lat: 41.378, lng: 60.364 },
  { id: "qoqon", name: "Qoqon", ru: "Коканд", en: "Kokand", lat: 40.533, lng: 71.02 },
  { id: "guliston", name: "Guliston", ru: "Гулистан", en: "Gulistan", lat: 40.488, lng: 68.785 },
  { id: "termiz", name: "Termiz", ru: "Термез", en: "Termez", lat: 37.224, lng: 67.278 },
  { id: "jizzax", name: "Jizzax", ru: "Джизак", en: "Jizzakh", lat: 40.116, lng: 67.842 },
];

const DISTRICTS = {
  toshkent: [
    { id: "yunusobod", name: "Yunusobod", ru: "Юнусабад", en: "Yunusobod", lat: 41.36, lng: 69.28 },
    { id: "yashnobod", name: "Yashnobod", ru: "Яшнабад", en: "Yashnobod", lat: 41.32, lng: 69.31 },
    { id: "olmazor", name: "Olmazor", ru: "Олмазор", en: "Olmazor", lat: 41.34, lng: 69.22 },
    { id: "shayxontohur", name: "Shayxontohur", ru: "Шайхантахур", en: "Shaykhontaur", lat: 41.33, lng: 69.23 },
    { id: "mirzo_ulugbek", name: "Mirzo Ulug'bek", ru: "Мирзо Улугбек", en: "Mirzo Ulugbek", lat: 41.37, lng: 69.34 },
    { id: "mirobod", name: "Mirobod", ru: "Миробод", en: "Mirobod", lat: 41.3, lng: 69.28 },
    { id: "oloniy", name: "O'loniy", ru: "Улугбек", en: "Ulugbek", lat: 41.35, lng: 69.31 },
    { id: "yaqutavod", name: "Yakkasaroy", ru: "Яккасарай", en: "Yakkasaroy", lat: 41.29, lng: 69.26 },
    { id: "uchqun", name: "Chilonzor", ru: "Чиланзар", en: "Chilanzar", lat: 41.28, lng: 69.2 },
    { id: "sergeli", name: "Sergeli", ru: "Сергели", en: "Sergeli", lat: 41.22, lng: 69.22 },
    { id: "mirobodtosh", name: "Uchtepa", ru: "Учтепа", en: "Uchtepa", lat: 41.3, lng: 69.17 },
    { id: "bektemir", name: "Bektemir", ru: "Бектемир", en: "Bektemir", lat: 41.25, lng: 69.35 },
    { id: "yashil", name: "Yashil", ru: "Язь-1", en: "Yashil", lat: 41.39, lng: 69.24 },
    { id: "shanoyi", name: "Shohona", ru: "Шохона", en: "Shahriston", lat: 41.32, lng: 69.26 },
  ],
};

async function seedReference() {
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

  if (await isEmpty("places")) {
    for (const city of CITIES) {
      await db.createDocument({
        databaseId,
        collectionId: "places",
        documentId: city.id,
        data: {
          name: city.name,
          ru: city.ru,
          en: city.en,
          kind: "city",
          parent: "",
          lat: city.lat,
          lng: city.lng,
          sort: 0,
          active: true,
        },
      });
      for (const district of DISTRICTS[city.id] ?? []) {
        await db.createDocument({
          databaseId,
          collectionId: "places",
          documentId: district.id,
          data: {
            name: district.name,
            ru: district.ru,
            en: district.en,
            kind: "district",
            parent: city.id,
            lat: district.lat,
            lng: district.lng,
            sort: 0,
            active: true,
          },
        });
      }
    }
    log(`  + ${CITIES.length} cities and ${Object.values(DISTRICTS).flat().length} districts`);
  }
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

  log(`bucket ${bucketId}`);
  await ensureBucket();

  await seedReference();

  // Nothing in the old product writes here any more; drop nothing, only report.
  for (const legacy of ["payments", "promotions"]) {
    try {
      const { total } = await db.listDocuments({
        databaseId,
        collectionId: legacy,
        queries: [Query.limit(1)],
      });
      log(`legacy ${legacy}: ${total} rows (unused, retained)`);
    } catch {
      log(`legacy ${legacy}: not present`);
    }
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
