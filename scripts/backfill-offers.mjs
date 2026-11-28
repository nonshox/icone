/**
 * Materialise one `offers` row per (barber, service) pair from the legacy
 * `services` catalogue and the `empser` overrides.
 *
 *   node scripts/backfill-offers.mjs
 *
 * Additive and idempotent: existing rows are counted as skipped, never
 * rewritten; nothing is deleted. Re-running after a partial failure only fills
 * the pairs still missing. Run `npm run db:setup` first so `offers` exists.
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
const num = (value, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bool = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;
const log = (message) => console.log(message);

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

/** Stable id so a retry cannot create a second row for the same pair. */
function offerId(barber, service) {
  const hash = createHash("sha1").update(`${barber}:${service}`).digest("hex");
  return `o${hash.slice(0, 32)}`;
}

async function main() {
  log("\nBackfill offers (services + empser -> offers)\n");

  try {
    await db.getCollection({ databaseId, collectionId: "offers" });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      log("  offers collection is missing. Run `npm run db:setup` first.");
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const [services, overrides, barbers, offers] = await Promise.all([
    allDocs("services"),
    allDocs("empser"),
    allDocs("barbers"),
    allDocs("offers"),
  ]);

  const staff = new Set(barbers.map((row) => row.$id));
  const overridesByService = new Map();
  for (const row of overrides) {
    const service = str(row.service);
    if (!overridesByService.has(service)) overridesByService.set(service, []);
    overridesByService.get(service).push(row);
  }
  const existing = new Set(offers.map((row) => `${str(row.barber)}|${str(row.service)}`));

  const candidates = [];
  const skipped = { retired: 0, noOwner: 0, inactive: 0, unknownBarber: 0 };
  for (const service of services) {
    if (!bool(service.active, true)) {
      skipped.retired += 1;
      continue;
    }
    const price = Math.max(0, Math.round(num(service.price)));
    const time = Math.min(480, Math.max(5, Math.round(num(service.time, 30) || 30)));
    const barber = str(service.barber);

    // An independent barber owns their own menu outright.
    if (barber) {
      if (!staff.has(barber)) {
        skipped.unknownBarber += 1;
        continue;
      }
      candidates.push({
        barber,
        service: service.$id,
        business: str(service.business),
        price,
        time,
        active: true,
        sort: num(service.sort),
      });
      continue;
    }

    const business = str(service.business);
    if (!business) {
      skipped.noOwner += 1;
      continue;
    }

    // A shared service is offered only by employees it is assigned to.
    for (const override of overridesByService.get(service.$id) ?? []) {
      if (!bool(override.active, true)) {
        skipped.inactive += 1;
        continue;
      }
      const employee = str(override.barber);
      if (!staff.has(employee)) {
        skipped.unknownBarber += 1;
        continue;
      }
      const inheritedPrice = num(override.price, -1);
      const inheritedTime = num(override.time, -1);
      candidates.push({
        barber: employee,
        service: service.$id,
        business,
        price: inheritedPrice >= 0 ? Math.max(0, Math.round(inheritedPrice)) : price,
        time: inheritedTime >= 0 ? Math.min(480, Math.max(5, Math.round(inheritedTime))) : time,
        active: true,
        sort: num(service.sort),
      });
    }
  }

  const counts = {
    services: services.length,
    overrides: overrides.length,
    candidates: candidates.length,
    created: 0,
    skipped: 0,
    conflicts: 0,
    errors: 0,
  };

  for (const candidate of candidates) {
    const key = `${candidate.barber}|${candidate.service}`;
    if (existing.has(key)) {
      counts.skipped += 1;
      continue;
    }
    try {
      await db.createDocument({
        databaseId,
        collectionId: "offers",
        documentId: offerId(candidate.barber, candidate.service),
        data: {
          barber: candidate.barber,
          service: candidate.service,
          business: candidate.business,
          price: candidate.price,
          time: candidate.time,
          active: candidate.active,
          sort: candidate.sort,
        },
      });
      existing.add(key);
      counts.created += 1;
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        // Another writer won the unique pair; leave their row untouched.
        existing.add(key);
        counts.conflicts += 1;
        continue;
      }
      counts.errors += 1;
      console.error(`  ! ${key}: ${error.message}`);
    }
  }

  log(
    `  services=${counts.services} empser=${counts.overrides} candidates=${counts.candidates}`,
  );
  log(
    `  created=${counts.created} skipped=${counts.skipped} conflicts=${counts.conflicts} errors=${counts.errors}`,
  );
  log(
    `  filtered: retired=${skipped.retired} noOwner=${skipped.noOwner} inactive=${skipped.inactive} unknownBarber=${skipped.unknownBarber}`,
  );
  if (counts.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
