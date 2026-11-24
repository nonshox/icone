import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { createNotification } from "@/lib/domain/customer";
import { ensureBarberChair } from "./data";

const APPLICATIONS = "applications";

type Row = Models.Document & Record<string, unknown>;

export type Application = {
  id: string;
  user: string;
  name: string;
  shop: string;
  city: string;
  address: string;
  phone: string;
  bio: string;
  state: "pending" | "approved" | "rejected";
  note: string;
  created: string;
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toApplication(row: Row): Application {
  const state = str(row.state, "pending");
  return {
    id: row.$id,
    user: str(row.user),
    name: str(row.name),
    shop: str(row.shop),
    city: str(row.city, "Tashkent"),
    address: str(row.address),
    phone: str(row.phone),
    bio: str(row.bio),
    state:
      state === "approved" || state === "rejected" ? state : "pending",
    note: str(row.note),
    created: row.$createdAt,
  };
}

async function list(queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: APPLICATIONS,
    queries,
  });
  return result.documents as Row[];
}

export async function getMyApplication(userId: string): Promise<Application | null> {
  const rows = await list([Query.equal("user", userId), Query.limit(1)]);
  return rows.length > 0 ? toApplication(rows[0]) : null;
}

export async function submitApplication(
  userId: string,
  input: {
    name: string;
    shop: string;
    city: string;
    address: string;
    phone: string;
    bio: string;
  },
  options: { autoApprove?: boolean } = {},
): Promise<Application> {
  const existing = await getMyApplication(userId);

  const data = { user: userId, ...input, state: "pending", note: "" };

  let row: Row;
  if (existing) {
    row = (await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: APPLICATIONS,
      documentId: existing.id,
      data: { ...input, state: "pending", note: "" },
    })) as Row;
  } else {
    try {
      row = (await adminDb().createDocument({
        databaseId: databaseId(),
        collectionId: APPLICATIONS,
        documentId: ID.unique(),
        data,
      })) as Row;
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        const again = await getMyApplication(userId);
        if (again) return again;
      }
      throw error;
    }
  }

  // Self-service onboarding: the application is also the approval.
  if (options.autoApprove) {
    return approveApplication(row.$id, toApplication(row), "");
  }

  const admins = await listDocs(TABLES.users, [
    Query.equal("role", "admin"),
    Query.limit(50),
  ]);
  for (const admin of admins) {
    await createNotification({
      user: admin.$id,
      title: "New barber application",
      body: `${input.name} applied with ${input.shop || "a new chair"}.`,
      kind: "admin",
    }).catch(() => {});
  }

  return toApplication(row);
}

async function listDocs(table: string, queries: string[]): Promise<Row[]> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: table,
    queries,
  });
  return result.documents as Row[];
}

export async function listApplications(): Promise<Application[]> {
  const rows = await list([Query.orderDesc("$createdAt"), Query.limit(100)]);
  return rows.map(toApplication);
}

/**
 * Promote the member, link the chair and close the application. The role is
 * the switch itself, so chair setup must never block it; a failed chair is
 * repaired on the member's first staff request.
 */
async function approveApplication(
  id: string,
  application: Application,
  note: string,
): Promise<Application> {
  let decisionNote = note;

  await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: TABLES.users,
    documentId: application.user,
    data: { role: "barber" },
  });

  try {
    await ensureBarberChair(application.user, {
      name: application.name,
      bio: application.bio,
      phone: application.phone,
      shop: application.shop,
      address: application.address,
      city: application.city,
    });
  } catch (error) {
    console.error(`[applications] chair setup failed for ${application.user}`, error);
    const hint = "Chair setup will finish when you open the dashboard.";
    decisionNote = decisionNote ? `${decisionNote} ${hint}` : hint;
  }

  const row = (await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: APPLICATIONS,
    documentId: id,
    data: { state: "approved", note: decisionNote },
  })) as Row;

  await createNotification({
    user: application.user,
    title: "You're a barber",
    body: "Your chair is live. Open your business dashboard to add services.",
    kind: "admin",
  }).catch(() => {});

  return toApplication(row);
}

/** Admin decision path. Self-service applications approve in submitApplication. */
export async function decideApplication(
  id: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<Application> {
  const current = await list([Query.equal("$id", id), Query.limit(1)]);
  if (current.length === 0) throw new Error("Application not found.");
  const application = toApplication(current[0]);

  if (decision === "approved") {
    return approveApplication(id, application, note);
  }

  const row = (await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: APPLICATIONS,
    documentId: id,
    data: { state: decision, note },
  })) as Row;

  await createNotification({
    user: application.user,
    title: "Application update",
    body: note || "Your application was not approved this time.",
    kind: "admin",
  }).catch(() => {});

  return toApplication(row);
}
