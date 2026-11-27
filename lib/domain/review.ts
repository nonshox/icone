import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { clean, create, first, list, num, str, update, type Row } from "./crud";
import { toBooking } from "./booking";
import { getProfiles } from "./account";
import { getBarbers, setRating } from "./professional";
import type { Review } from "./types";

const SIZES = { note: 512, reply: 512 };

/** Only visits that actually happened can be reviewed. */
const REVIEWABLE = ["done", "noshow"];

export function toReview(row: Row): Review {
  return {
    id: row.$id,
    user: str(row.user),
    barber: str(row.barber),
    booking: str(row.booking),
    rate: num(row.rate, 5),
    note: str(row.note),
    reply: str(row.reply),
    state: (str(row.state, "open") || "open") as Review["state"],
    business: str(row.business),
    created: row.$createdAt,
    userName: "",
    userAvatar: "",
  };
}

/** A review that customers are allowed to see. */
export function isVisible(review: Review): boolean {
  return review.state === "open";
}

/* ------------------------------------------------------------------- reads */

export async function listReviews(
  barberId: string,
  options: { visibleOnly?: boolean; limit?: number } = {},
): Promise<Review[]> {
  const rows = await list(TABLES.reviews, [
    Query.equal("barber", barberId),
    Query.orderDesc("$createdAt"),
    Query.limit(options.limit ?? 50),
  ]);

  const reviews = rows.map(toReview);
  return options.visibleOnly === false ? reviews : reviews.filter(isVisible);
}

/** Reviews with the author's name resolved, newest first. */
export async function reviewsWithAuthors(barberId: string, limit = 50): Promise<Review[]> {
  const reviews = await listReviews(barberId, { limit });
  const authors = await getProfiles(reviews.map((row) => row.user));

  return reviews.map((review) => ({
    ...review,
    userName: authors.get(review.user)?.name ?? "",
    userAvatar: authors.get(review.user)?.avatar ?? "",
  }));
}

export async function reviewForBooking(bookingId: string): Promise<Review | null> {
  const row = await first(TABLES.reviews, [Query.equal("booking", bookingId)]);
  return row ? toReview(row) : null;
}

export async function reviewsByUser(userId: string): Promise<Review[]> {
  const rows = await list(TABLES.reviews, [
    Query.equal("user", userId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return rows.map(toReview);
}

export type RatingSummary = {
  average: number;
  count: number;
  distribution: number[];
};

/** Average, total and a five-bar histogram for one professional. */
export async function ratingSummary(barberId: string): Promise<RatingSummary> {
  const reviews = await listReviews(barberId);
  const distribution = [0, 0, 0, 0, 0];

  for (const review of reviews) {
    const index = Math.min(4, Math.max(0, Math.round(review.rate) - 1));
    distribution[index] += 1;
  }

  const count = reviews.length;
  const total = reviews.reduce((sum, review) => sum + review.rate, 0);

  return {
    average: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    count,
    distribution,
  };
}

/* ------------------------------------------------------------------ writes */

/**
 * Record a review for one completed visit.
 *
 * The booking is re-read here: a customer must actually own a finished
 * appointment with that professional, and each appointment can only be
 * reviewed once (the unique index on `booking` enforces it for races too).
 */
export async function createReview(input: {
  user: string;
  bookingId: string;
  rate: number;
  note?: string;
}): Promise<{ ok: true; review: Review } | { ok: false; status: number; code: string; message: string }> {
  const row = await first(TABLES.bookings, [Query.equal("$id", input.bookingId)]);
  if (!row) {
    return { ok: false, status: 404, code: "no_booking", message: "That appointment no longer exists." };
  }

  const booking = toBooking(row);

  if (booking.user !== input.user) {
    return { ok: false, status: 403, code: "not_yours", message: "That appointment is not yours." };
  }

  if (!REVIEWABLE.includes(booking.status)) {
    return {
      ok: false,
      status: 409,
      code: "not_finished",
      message: "You can review an appointment once it is finished.",
    };
  }

  const rate = Math.min(5, Math.max(1, Math.round(input.rate)));
  const existing = await first(TABLES.reviews, [Query.equal("booking", booking.id)]);
  if (existing) {
    return { ok: false, status: 409, code: "already", message: "You already reviewed this visit." };
  }

  try {
    const created = await create(TABLES.reviews, {
      user: input.user,
      barber: booking.barber,
      booking: booking.id,
      rate,
      note: clean(input.note ?? "", SIZES.note),
      reply: "",
      state: "open",
      business: booking.business,
    });

    const review = toReview(created);
    await refreshBarberRating(booking.barber);
    return { ok: true, review };
  } catch (error) {
    // The unique index on `booking` rejects a second review for the same visit.
    const code =
      error && typeof error === "object" && "code" in error ? Number(error.code) : 0;
    if (code === 409) {
      return { ok: false, status: 409, code: "already", message: "You already reviewed this visit." };
    }
    throw error;
  }
}

/** Let a professional answer a review publicly. */
export async function replyToReview(
  id: string,
  reply: string,
): Promise<Review> {
  const row = await update(TABLES.reviews, id, { reply: clean(reply, SIZES.reply) });
  return toReview(row);
}

/** Platform moderation: hide or restore a review. */
export async function setReviewState(id: string, state: Review["state"]): Promise<Review> {
  const row = await update(TABLES.reviews, id, { state });
  return toReview(row);
}

/** Recompute and store the cached average shown in search results. */
export async function refreshBarberRating(barberId: string): Promise<number> {
  const summary = await ratingSummary(barberId);
  await setRating(barberId, summary.average);

  const barber = await getBarbers([barberId]);
  const row = barber.get(barberId);
  if (row?.business) {
    await refreshBusinessRating(row.business);
  }
  return summary.average;
}

/** A business averages the ratings of the professionals working there. */
export async function refreshBusinessRating(businessId: string): Promise<void> {
  const rows = await list(TABLES.barbers, [
    Query.equal("business", businessId),
    Query.limit(100),
  ]);

  const ratings = rows.map((row) => num(row.rating)).filter((value) => value > 0);
  if (ratings.length === 0) return;

  const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
  await update(TABLES.businesses, businessId, {
    rating: Math.round(average * 10) / 10,
  });
}

/** Whether this customer still owes a review for this visit. */
export async function pendingReview(userId: string): Promise<string[]> {
  const rows = await list(TABLES.bookings, [
    Query.equal("user", userId),
    Query.equal("status", ["done", "noshow"]),
    Query.limit(100),
  ]);

  const reviews = await list(TABLES.reviews, [
    Query.equal("user", userId),
    Query.limit(100),
  ]);
  const done = new Set(reviews.map((row) => str(row.booking)));

  return rows.map((row) => toBooking(row).id).filter((id) => !done.has(id));
}
