import "server-only";

import { AppwriteException, Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { findClient, toClient, type ClientRow } from "./appointment";
import {
  bool,
  clean,
  create,
  first,
  get,
  json,
  list,
  phone as normalizePhone,
  str,
  update,
  type Row,
} from "./crud";
import type { CustomerRecord } from "./types";

export type { CustomerRecord } from "./types";

/**
 * Tier-2 customer records: one person per business.
 *
 * `clients` stays in place for one release, so reads still fall back to it for
 * rows the backfill has not reached. `customers` is additive — nothing in the
 * legacy table is deleted or rewritten. For an independent barber, whose
 * profile has no business id, `business` holds the barber id so two barbers can
 * never share a customer record.
 *
 * `TABLES` gains `customers` with the Tier-2 schema; the cast keeps this module
 * compiling while that change lands.
 */
const CUSTOMERS = (TABLES as Record<string, string | undefined>).customers ?? "customers";

export type CustomerInput = {
  business: string;
  user?: string;
  phone?: string;
  name?: string;
  note?: string;
  active?: boolean;
  aliases?: string[];
  id?: string;
};

export type MergeReport = {
  business: string;
  phone: string;
  customers: CustomerRecord[];
  clients: ClientRow[];
  keep: string;
  duplicates: number;
  changes: 0;
};

export function toCustomer(row: Row): CustomerRecord {
  const raw = row.aliases;
  const aliases = Array.isArray(raw)
    ? raw.map((value) => str(value)).filter(Boolean)
    : json<string[]>(raw, []);
  return {
    id: row.$id,
    business: str(row.business),
    user: str(row.user),
    phone: str(row.phone),
    name: str(row.name),
    note: str(row.note),
    active: bool(row.active, true),
    aliases: aliases.slice(0, 24),
  };
}

/** A legacy client record is returned in the same shape, with its id aliased. */
function fromClient(row: ClientRow): CustomerRecord {
  return {
    id: "",
    business: row.business,
    user: row.user,
    phone: row.phone,
    name: row.name,
    note: row.note,
    active: row.active,
    aliases: [row.id],
  };
}

function collectionMissing(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404;
}

async function safeFirst(table: string, queries: string[]): Promise<Row | null> {
  try {
    return await first(table, queries);
  } catch (error) {
    if (collectionMissing(error)) return null;
    throw error;
  }
}

async function safeGet(table: string, id: string): Promise<Row | null> {
  try {
    return await get(table, id);
  } catch (error) {
    if (collectionMissing(error)) return null;
    throw error;
  }
}

async function safeList(table: string, queries: string[]): Promise<Row[]> {
  try {
    return await list(table, queries);
  } catch (error) {
    if (collectionMissing(error)) return [];
    throw error;
  }
}

/** Match by account first, then by phone — always inside the same business. */
async function findCustomerRow(input: {
  business: string;
  user?: string;
  phone?: string;
}): Promise<CustomerRecord | null> {
  if (!input.business) return null;

  if (input.user) {
    const row = await safeFirst(CUSTOMERS, [
      Query.equal("business", input.business),
      Query.equal("user", input.user),
    ]);
    if (row) return toCustomer(row);
  }

  const key = normalizePhone(input.phone ?? "");
  if (key) {
    const row = await safeFirst(CUSTOMERS, [
      Query.equal("business", input.business),
      Query.equal("phone", key),
    ]);
    if (row) return toCustomer(row);
  }
  return null;
}

/* ------------------------------------------------------------------ reads */

/**
 * The customer a business should see. Materialised records win; `clients` is
 * the fallback until every historical row has been backfilled. A null id means
 * the result came from the legacy table.
 */
export async function customerFor(input: {
  business: string;
  user?: string;
  phone?: string;
  name?: string;
}): Promise<CustomerRecord | null> {
  const current = await findCustomerRow(input);
  if (current) return current;

  const legacy = await findClient({
    business: input.business,
    phone: normalizePhone(input.phone ?? ""),
    user: input.user,
  });
  return legacy ? fromClient(legacy) : null;
}

/**
 * Report duplicate phone numbers without merging them. Historical rows are
 * never rewritten: a human decides which id to keep.
 */
export async function mergeByPhone(input: {
  business: string;
  phone: string;
}): Promise<MergeReport> {
  const key = normalizePhone(input.phone);
  const empty: MergeReport = {
    business: input.business,
    phone: key,
    customers: [],
    clients: [],
    keep: "",
    duplicates: 0,
    changes: 0,
  };
  if (!input.business || !key) return empty;

  const [rows, legacy] = await Promise.all([
    safeList(CUSTOMERS, [
      Query.equal("business", input.business),
      Query.equal("phone", key),
      Query.limit(100),
    ]),
    safeList(TABLES.clients, [
      Query.equal("business", input.business),
      Query.equal("phone", key),
      Query.limit(100),
    ]),
  ]);

  const customers = rows.map(toCustomer);
  return {
    business: input.business,
    phone: key,
    customers,
    clients: legacy.map(toClient),
    keep: customers[0]?.id ?? "",
    duplicates: Math.max(0, customers.length - 1),
    changes: 0,
  };
}

/* ----------------------------------------------------------------- writes */

/** Create or refresh one customer record, keeping one row per identity. */
export async function upsertCustomer(input: CustomerInput): Promise<CustomerRecord | null> {
  if (!input.business) return null;

  const keyPhone = normalizePhone(input.phone ?? "");
  let currentRow: Row | null = null;
  if (input.id) {
    currentRow = await safeGet(CUSTOMERS, input.id);
  } else if (input.user) {
    currentRow = await safeFirst(CUSTOMERS, [
      Query.equal("business", input.business),
      Query.equal("user", input.user),
    ]);
  } else if (keyPhone) {
    currentRow = await safeFirst(CUSTOMERS, [
      Query.equal("business", input.business),
      Query.equal("phone", keyPhone),
    ]);
  }
  const current = currentRow ? toCustomer(currentRow) : null;

  const aliases = [...new Set([...(current?.aliases ?? []), ...(input.aliases ?? [])])]
    .map((value) => clean(value, 64))
    .filter(Boolean)
    .slice(0, 24);

  const data = {
    business: input.business,
    user: input.user ?? current?.user ?? "",
    phone: normalizePhone(input.phone ?? current?.phone ?? ""),
    name: clean(input.name ?? current?.name ?? "", 64) || "Customer",
    note: clean(input.note ?? current?.note ?? "", 512),
    active: input.active ?? current?.active ?? true,
    // The schema stores aliases as a JSON string (one lowercase word keys).
    aliases: JSON.stringify(aliases),
  };

  const row = current
    ? await update(CUSTOMERS, current.id, data)
    : await create(CUSTOMERS, data);
  return toCustomer(row);
}

/**
 * Link a booking to its customer record. Optional during the migration: a
 * missing `bookings.customer` attribute must never fail a booking write.
 *
 * `onlyIfEmpty` (the default) makes backfills and retries idempotent.
 */
export async function attachCustomer(
  bookingId: string,
  customerId: string,
  options: { onlyIfEmpty?: boolean } = {},
): Promise<boolean> {
  if (!bookingId || !customerId) return false;
  try {
    const row = await get(TABLES.bookings, bookingId);
    if (!row) return false;
    if ((options.onlyIfEmpty ?? true) && str(row.customer)) return false;
    await update(TABLES.bookings, bookingId, { customer: customerId });
    return true;
  } catch (error) {
    console.error("[customers] could not attach customer to booking", error);
    return false;
  }
}

/** Exposed for the CRM route when it starts reading materialised customers. */
export { findCustomerRow, fromClient };
