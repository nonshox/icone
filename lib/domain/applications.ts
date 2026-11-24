import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId, TABLES } from "@/lib/appwrite/db";
import { createNotification } from "@/lib/domain/customer";

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
): Promise<Application> {
  const existing = await getMyApplication(userId);
  if (existing && existing.state === "pending") return existing;

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

/** Approve: create/link the chair and promote the member. Reject: close it. */
export async function decideApplication(
  id: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<Application> {
  const current = await list([Query.equal("$id", id), Query.limit(1)]);
  if (current.length === 0) throw new Error("Application not found.");
  const application = toApplication(current[0]);

  if (decision === "approved") {
    const existingChair = await listDocs(TABLES.barbers, [
      Query.equal("user", application.user),
      Query.limit(1),
    ]);

    if (existingChair.length === 0) {
      await adminDb().createDocument({
        databaseId: databaseId(),
        collectionId: TABLES.barbers,
        documentId: ID.unique(),
        data: {
          name: application.name,
          title: "Barber",
          bio: application.bio,
          photo: "",
          rating: 0,
          active: true,
          user: application.user,
          shop: application.shop,
          address: application.address,
          city: application.city,
          years: 0,
          skills: "",
          phone: application.phone,
          social: "",
          facilities: "",
          policy: "Arrive 5 minutes early. Cancel at least 2 hours before.",
          cover: "",
          confirm: false,
          featured: false,
        },
      });
    }

    await adminDb().updateDocument({
      databaseId: databaseId(),
      collectionId: TABLES.users,
      documentId: application.user,
      data: { role: "barber" },
    });
  }

  const row = (await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: APPLICATIONS,
    documentId: id,
    data: { state: decision, note },
  })) as Row;

  await createNotification({
    user: application.user,
    title: decision === "approved" ? "You're a barber" : "Application update",
    body:
      decision === "approved"
        ? "Your chair is live. Open your business dashboard to add services."
        : note || "Your application was not approved this time.",
    kind: "admin",
  }).catch(() => {});

  return toApplication(row);
}
