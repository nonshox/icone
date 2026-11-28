/**
 * Materialise one `customers` row per person per business, then fill the empty
 * `bookings.customer` links.
 *
 *   node scripts/backfill-customers.mjs
 *
 * Additive and idempotent: existing rows and already-linked bookings are
 * counted and left alone; nothing is deleted or merged. `clients` rows stay in
 * place and are recorded in `customers.aliases`. For an independent barber
 * (no business id) the barber id is used as the owner, so two barbers can never
 * share a customer. Run `npm run db:setup` first so the new schema exists.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { AppwriteException, Client, Databases, Query } from "node-appwrite";

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

const str = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;
const bool = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;
const log = (message) => console.log(message);

function normalizePhone(value) {
  const digits = str(value).replace(/[^\d]/g, "");
  if (digits.startsWith("998") && digits.length === 12) return digits;
  if (digits.length === 9) return `998${digits}`;
  return "";
}

const ownerOf = (row) => str(row.business) || str(row.barber) || "";

async function allDocs(collectionId, queries = []) {
  const rows = [];
  const page = 100;
  for (let offset = 0; ; offset += page) {
    const { documents } = await db.listDocuments({
      databaseId,
      collectionId,
      queries: [...queries, Query.limit(page), Query.offset(offset)],
    });
    rows.push(...documents);
    if (documents.length < page) break;
  }
  return rows;
}

function customerId(owner, identity) {
  const hash = createHash("sha1").update(`${owner}:${identity}`).digest("hex");
  return `c${hash.slice(0, 32)}`;
}

function aliasesOf(row) {
  const raw = row.aliases;
  if (Array.isArray(raw)) return raw.map((value) => str(value)).filter(Boolean);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function unknownAttribute(error) {
  return (
    error instanceof AppwriteException &&
    error.code === 400 &&
    /attribute/i.test(error.message ?? "")
  );
}

async function main() {
  log("\nBackfill customers (clients + bookings -> customers)\n");

  try {
    await db.getCollection({ databaseId, collectionId: "customers" });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      log("  customers collection is missing. Run `npm run db:setup` first.");
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const [clients, bookings, existing, users] = await Promise.all([
    allDocs("clients"),
    allDocs("bookings"),
    allDocs("customers"),
    allDocs("users"),
  ]);

  const clientById = new Map(clients.map((row) => [row.$id, row]));
  const userById = new Map(users.map((row) => [row.$id, row]));

  const byUser = new Map();
  const byPhone = new Map();
  const byAlias = new Map();
  for (const row of existing) {
    const owner = str(row.business);
    const user = str(row.user);
    const phone = normalizePhone(row.phone);
    if (user) byUser.set(`${owner}|${user}`, row.$id);
    if (phone) byPhone.set(`${owner}|${phone}`, row.$id);
    for (const alias of aliasesOf(row)) byAlias.set(alias, row.$id);
  }

  // Group every historical identity into one candidate per owner. A booking
  // that points at a legacy client must land on that client's candidate even
  // when the client row also has a phone number.
  const candidates = new Map();
  const candidateByAlias = new Map();
  function add(input) {
    if (!input.business) return;
    const identity = input.user || input.phone || input.alias;
    const key =
      (input.linkAlias && candidateByAlias.get(input.linkAlias)) ||
      `${input.business}|${identity || ""}`;
    const found = candidates.get(key);
    const record = found ?? {
      business: input.business,
      user: input.user,
      phone: input.phone,
      name: input.name || "Customer",
      note: input.note,
      active: input.active,
      aliases: [],
      links: [],
    };
    if (found) {
      if (!found.user && input.user) found.user = input.user;
      if (!found.phone && input.phone) found.phone = input.phone;
      if (input.name && (!found.name || found.name === "Customer")) found.name = input.name;
      found.aliases = [...new Set([...found.aliases, ...input.aliases])].slice(0, 24);
    }
    if (input.link) record.links.push(input.link);
    record.links = [...new Set(record.links)];
    for (const alias of input.aliases) candidateByAlias.set(alias, key);
    if (!found) candidates.set(key, record);
  }

  for (const row of clients) {
    add({
      business: ownerOf(row),
      user: str(row.user),
      phone: normalizePhone(row.phone),
      name: str(row.name),
      note: str(row.note),
      active: bool(row.active, true),
      alias: row.$id,
      aliases: [row.$id],
      link: str(row.user) || row.$id,
    });
  }

  for (const row of bookings) {
    const user = str(row.user);
    const client = str(row.client);
    if (!user && !client) continue;
    const clientRow = clientById.get(client);
    const profile = userById.get(user);
    add({
      business: ownerOf(row),
      user,
      phone: normalizePhone(clientRow?.phone ?? profile?.phone),
      name: str(profile?.name) || str(clientRow?.name),
      note: str(clientRow?.note),
      active: true,
      alias: client,
      aliases: client ? [client] : [],
      link: user || client,
      linkAlias: client,
    });
  }

  const counts = {
    clients: clients.length,
    bookings: bookings.length,
    candidates: candidates.size,
    created: 0,
    existing: 0,
    conflicts: 0,
    errors: 0,
    linked: 0,
    alreadyLinked: 0,
    unresolved: 0,
  };

  // Candidate key -> customer id, and owner + user/client id -> customer id.
  const resolved = new Map();
  const bookingLink = new Map();
  function settle(key, id) {
    resolved.set(key, id);
    const candidate = candidates.get(key);
    for (const link of candidate?.links ?? []) {
      bookingLink.set(`${candidate.business}|${link}`, id);
    }
  }

  for (const [key, candidate] of candidates) {
    const found =
      (candidate.user && byUser.get(`${candidate.business}|${candidate.user}`)) ||
      (candidate.phone && byPhone.get(`${candidate.business}|${candidate.phone}`)) ||
      candidate.aliases.map((alias) => byAlias.get(alias)).find(Boolean);

    if (found) {
      settle(key, found);
      counts.existing += 1;
      continue;
    }

    const id = customerId(candidate.business, candidate.user || candidate.phone || key);
    try {
      await db.createDocument({
        databaseId,
        collectionId: "customers",
        documentId: id,
        data: {
          business: candidate.business,
          user: candidate.user,
          phone: candidate.phone,
          name: candidate.name.slice(0, 64) || "Customer",
          note: candidate.note.slice(0, 512),
          active: candidate.active,
          aliases: JSON.stringify(candidate.aliases),
        },
      });
      settle(key, id);
      byUser.set(`${candidate.business}|${candidate.user}`, id);
      if (candidate.phone) byPhone.set(`${candidate.business}|${candidate.phone}`, id);
      for (const alias of candidate.aliases) byAlias.set(alias, id);
      counts.created += 1;
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        settle(key, id);
        counts.conflicts += 1;
        continue;
      }
      counts.errors += 1;
      console.error(`  ! ${key}: ${error.message}`);
    }
  }

  let attributeMissing = false;
  for (const row of bookings) {
    if (str(row.customer)) {
      counts.alreadyLinked += 1;
      continue;
    }
    const user = str(row.user);
    const client = str(row.client);
    if (!user && !client) {
      counts.unresolved += 1;
      continue;
    }
    const id = bookingLink.get(`${ownerOf(row)}|${user || client}`);
    if (!id) {
      counts.unresolved += 1;
      continue;
    }
    if (attributeMissing) continue;
    try {
      await db.updateDocument({
        databaseId,
        collectionId: "bookings",
        documentId: row.$id,
        data: { customer: id },
      });
      counts.linked += 1;
    } catch (error) {
      if (unknownAttribute(error)) {
        attributeMissing = true;
        log("  bookings.customer is missing; run `npm run db:setup`.");
        continue;
      }
      counts.errors += 1;
      console.error(`  ! booking ${row.$id}: ${error.message}`);
    }
  }

  log(
    `  clients=${counts.clients} bookings=${counts.bookings} candidates=${counts.candidates}`,
  );
  log(
    `  created=${counts.created} existing=${counts.existing} conflicts=${counts.conflicts} errors=${counts.errors}`,
  );
  log(
    `  bookings linked=${counts.linked} already=${counts.alreadyLinked} unresolved=${counts.unresolved}`,
  );
  if (counts.errors > 0 || attributeMissing) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
