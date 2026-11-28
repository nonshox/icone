import "server-only";

import { Query } from "node-appwrite";
import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  businessFailure,
  firstIssue,
  readJson,
  requireWorkspace,
  writeDenied,
  type Workspace,
} from "@/app/api/barber/_auth";
import type { Actor } from "@/lib/domain/access";
import { TABLES } from "@/lib/appwrite/db";
import { getProfiles } from "@/lib/domain/account";
import { createClient, findClient } from "@/lib/domain/appointment";
import { toBooking } from "@/lib/domain/booking";
import { bool, list, str, update, type Row } from "@/lib/domain/crud";
import { label } from "@/lib/domain/time";
import { isCompleted, isVisit, type Booking, type Profile } from "@/lib/domain/types";
import { apiError, apiOk } from "@/lib/http";

const noteSchema = z
  .object({
    userId: z.string().trim().min(1).max(36).optional(),
    client: z.string().trim().min(1).max(36).optional(),
    note: z.string().trim().max(512),
  })
  .refine((value) => Boolean(value.userId || value.client), {
    message: "Pick a customer.",
  });

/** An owner sees everyone in the shop; a barber sees their own visitors. */
function targetWorkspace(actor: Actor, workspace: Workspace): Workspace {
  const business = workspace.business || actor.owns[0] || "";
  return actor.owns.length > 0 || !workspace.barber
    ? { barber: "", business }
    : workspace;
}

type CustomerData = {
  workspace: Workspace;
  bookings: Booking[];
  profiles: Map<string, Profile>;
  serviceNames: Map<string, string>;
  clientRows: Row[];
  clientNames: Map<string, string>;
  clientPhones: Map<string, string>;
  notes: Map<string, string>;
  noteIds: Map<string, string>;
};

/**
 * Customers are derived from this workspace's own bookings. Private notes
 * live on the customer record, keyed by user inside this workspace, and are
 * never returned to customers.
 */
async function loadData(workspace: Workspace): Promise<CustomerData> {
  const owner = workspace.barber
    ? Query.equal("barber", workspace.barber)
    : Query.equal("business", workspace.business);
  const rows = await list(TABLES.bookings, [
    owner,
    Query.orderDesc("date"),
    Query.limit(500),
  ]);
  const bookings = rows.map(toBooking);
  const customerIds = [
    ...new Set(bookings.map((row) => row.user || row.client).filter(Boolean)),
  ];
  const serviceIds = [...new Set(bookings.map((row) => row.service).filter(Boolean))];

  const [profiles, clientRows, serviceRows] = await Promise.all([
    getProfiles(customerIds),
    list(TABLES.clients, [
      ...(workspace.barber
        ? [Query.equal("barber", workspace.barber)]
        : [Query.equal("business", workspace.business)]),
      Query.limit(200),
    ]),
    serviceIds.length > 0
      ? list(TABLES.services, [Query.equal("$id", serviceIds), Query.limit(100)])
      : [],
  ]);

  const clientNames = new Map<string, string>();
  const clientPhones = new Map<string, string>();
  const notes = new Map<string, string>();
  const noteIds = new Map<string, string>();
  for (const row of clientRows) {
    clientNames.set(row.$id, str(row.name, "Walk-in"));
    clientPhones.set(row.$id, str(row.phone));
    const user = str(row.user);
    if (user) {
      notes.set(user, str(row.note));
      noteIds.set(user, row.$id);
      if (!clientNames.has(user)) clientNames.set(user, str(row.name));
      if (!clientPhones.has(user)) clientPhones.set(user, str(row.phone));
    }
  }

  return {
    workspace,
    bookings,
    profiles,
    serviceNames: new Map(serviceRows.map((row) => [row.$id, str(row.name, "Service")])),
    clientRows,
    clientNames,
    clientPhones,
    notes,
    noteIds,
  };
}

function toCustomer(id: string, data: CustomerData) {
  const mine = data.bookings.filter((row) => (row.user || row.client) === id);
  const profile = data.profiles.get(id);
  const client = data.clientRows.find(
    (row) => str(row.user) === id || row.$id === id,
  );
  return {
    id,
    user: str(client?.user ?? id),
    business: str(client?.business ?? data.workspace.business),
    barber: str(client?.barber ?? data.workspace.barber),
    active: client ? bool(client.active, true) : true,
    name: profile?.name ?? data.clientNames.get(id) ?? "Member",
    phone: profile?.phone ?? data.clientPhones.get(id) ?? "",
    avatar: profile?.avatar ?? "",
    visits: mine.filter((row) => isVisit(row.status)).length,
    completed: mine.filter((row) => isCompleted(row.status)).length,
    spend: mine
      .filter((row) => isCompleted(row.status))
      .reduce((total, row) => total + row.price, 0),
    last: mine.reduce((last, row) => (row.date > last ? row.date : last), ""),
    services: [
      ...new Set(mine.map((row) => data.serviceNames.get(row.service) ?? "Service")),
    ],
    note: data.notes.get(id) ?? "",
    noteId: data.noteIds.get(id) ?? "",
  };
}

function bookingsOf(id: string, data: CustomerData) {
  return data.bookings
    .filter((row) => (row.user || row.client) === id)
    .map((row) => ({
      id: row.id,
      date: row.date,
      time: label(row.start),
      service: data.serviceNames.get(row.service) ?? "Service",
      status: row.status,
      price: row.price,
      note: row.note,
    }));
}

/** GET /api/barber/customers[?id=…] — visitors or one member's full history. */
export async function GET(request: NextRequest) {
  const guarded = await requireWorkspace("customer.read");
  if (!guarded.ok) return guarded.response;

  const id = request.nextUrl.searchParams.get("id");
  try {
    const data = await loadData(targetWorkspace(guarded.actor, guarded.workspace));
    if (id) {
      if (!data.bookings.some((row) => (row.user || row.client) === id)) {
        return apiError("That member is not a customer here.", 404, "not_found");
      }
      const customer = toCustomer(id, data);
      return apiOk({
        customer: { ...customer, customer, bookings: bookingsOf(id, data) },
      });
    }

    const ids = [
      ...new Set(data.bookings.map((row) => row.user || row.client).filter(Boolean)),
    ];
    const customers = ids
      .map((customerId) => toCustomer(customerId, data))
      .sort((a, b) =>
        a.last === b.last ? b.visits - a.visits : a.last < b.last ? 1 : -1,
      );
    return apiOk({ customers });
  } catch (error) {
    return businessFailure(error, "Could not load your customers.", "customers_failed");
  }
}

/** PATCH /api/barber/customers — private note, never exposed to members. */
export async function PATCH(request: NextRequest) {
  const guarded = await requireWorkspace("customer.write");
  if (!guarded.ok) return guarded.response;

  const denied = await writeDenied(
    request,
    `barber:customers:${guarded.actor.userId}`,
    60,
  );
  if (denied) return denied;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = noteSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the note."), 400, "invalid_note");
  }

  const workspace = targetWorkspace(guarded.actor, guarded.workspace);
  const customerId = (parsed.data.userId ?? parsed.data.client)!;
  try {
    const data = await loadData(workspace);
    if (!data.bookings.some((row) => (row.user || row.client) === customerId)) {
      return apiError("That member is not a customer here.", 404, "not_found");
    }

    const existing = await findClient({
      business: workspace.business,
      phone: "",
      user: customerId,
    });
    let recordId = existing?.id ?? "";
    if (!recordId && parsed.data.note) {
      const created = await createClient({
        business: workspace.business,
        barber: workspace.barber,
        user: customerId,
        name: data.profiles.get(customerId)?.name ?? "Customer",
      });
      recordId = created.id;
    }
    if (recordId) await update(TABLES.clients, recordId, { note: parsed.data.note });

    const client = { ...toCustomer(customerId, data), note: parsed.data.note };
    return apiOk({
      client,
      note: parsed.data.note
        ? {
            id: recordId,
            barber: workspace.barber,
            user: customerId,
            note: parsed.data.note,
          }
        : null,
    });
  } catch (error) {
    return businessFailure(error, "Could not save the note.", "note_failed");
  }
}
