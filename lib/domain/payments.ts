import "server-only";

import { AppwriteException, ID, Query, type Models } from "node-appwrite";

import { adminDb, databaseId } from "@/lib/appwrite/db";

import { barberForUser } from "./data";
import type { Role } from "./types";

/** Collection created by `scripts/setup-appwrite.mjs`. */
const PAYMENTS = "payments";

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "partial",
  "refunded",
  "unpaid",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["shop", "card", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending at shop",
  paid: "Paid",
  partial: "Partly paid",
  refunded: "Refunded",
  unpaid: "Unpaid",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  shop: "At the shop",
  card: "Card",
  transfer: "Transfer",
};

export type Payment = {
  id: string;
  booking: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  created: string;
};

export type Actor = { id: string; role: Role };

type Row = Models.Document & Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPayment(row: Row): Payment {
  return {
    id: row.$id,
    booking: str(row.booking),
    amount: typeof row.amount === "number" ? row.amount : 0,
    status: str(row.status, "pending") as PaymentStatus,
    method: str(row.method, "shop") as PaymentMethod,
    created: row.$createdAt,
  };
}

async function forBooking(bookingId: string): Promise<Row | null> {
  const result = await adminDb().listDocuments({
    databaseId: databaseId(),
    collectionId: PAYMENTS,
    queries: [Query.equal("booking", bookingId), Query.limit(1)],
  });
  return (result.documents as Row[])[0] ?? null;
}

export async function getPaymentForBooking(
  bookingId: string,
): Promise<Payment | null> {
  const row = await forBooking(bookingId);
  return row ? toPayment(row) : null;
}

/**
 * One payment row per booking. Called after a booking is confirmed; a failure
 * here is logged by the caller but never rolls the booking back.
 */
export async function ensurePayment(
  bookingId: string,
  amount: number,
): Promise<Payment> {
  const existing = await forBooking(bookingId);
  if (existing) return toPayment(existing);

  try {
    const row = await adminDb().createDocument({
      databaseId: databaseId(),
      collectionId: PAYMENTS,
      documentId: ID.unique(),
      data: {
        booking: bookingId,
        amount,
        status: "pending",
        method: "shop",
      },
    });
    return toPayment(row as Row);
  } catch (error) {
    // A parallel request may have created the row first.
    if (error instanceof AppwriteException && error.code === 409) {
      const created = await forBooking(bookingId);
      if (created) return toPayment(created);
    }
    throw error;
  }
}

export async function updatePayment(
  id: string,
  patch: { status?: PaymentStatus; method?: PaymentMethod },
): Promise<Payment> {
  const row = await adminDb().updateDocument({
    databaseId: databaseId(),
    collectionId: PAYMENTS,
    documentId: id,
    data: patch,
  });
  return toPayment(row as Row);
}

/** Read access: booking owner, any staff member. */
export function canReadPayment(
  actor: Actor,
  booking: { user: string; barber: string },
): boolean {
  if (booking.user === actor.id) return true;
  return actor.role === "admin" || actor.role === "barber";
}

/**
 * Write access: only the barber whose chair hosted the visit. Admins can read
 * all payments but cannot change them.
 */
export async function canUpdatePayment(
  actor: Actor,
  booking: { barber: string },
): Promise<boolean> {
  if (actor.role !== "barber") return false;
  const chair = await barberForUser(actor.id);
  return Boolean(chair && chair.id === booking.barber);
}
